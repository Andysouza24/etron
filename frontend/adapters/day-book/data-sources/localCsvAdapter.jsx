// local CSV adapter descriptor
// does not need runtime adapter as file lives on device until connection is finalised
// declares wizard config addressable through DataAdapterFactory

import React from "react";
import { router } from "expo-router";

import { apiPost } from "../../../utils/api/apiClient";
import endpoints from "../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../storage/workspaceStorage";

import CsvConnectStep from "./csv/wizard-steps/CsvConnectStep";
import FieldCategoryReviewStep from "../../../components/modules/day-book/data-sources/wizard/steps/FieldCategoryReviewStep";
import GeneralSettingsStep from "../../../components/modules/day-book/data-sources/wizard/steps/GeneralSettingsStep";
import CsvSettingsExtra from "./csv/wizard-steps/CsvSettingsExtra";

const TYPE = "local-csv";

// CSV is purely local until finalised
// expose a no-op factory so callers that resolve adapters by type do not blow up
const createLocalCsvAdapter = () => ({
    type: TYPE,
    isConnected: () => false,
    connect: async () => ({ connected: true }),
    disconnect: async () => ({ connected: true }),
});

const finaliseLocalCsv = async (draft) => {
    const { name, method = "overwrite", confirmedSchema, rawData } = draft;
    if (!name?.trim()) throw new Error("Connection name is required");
    if (!rawData) throw new Error("No CSV data was loaded");
    if (!confirmedSchema?.length) throw new Error("Schema has not been reviewed");

    const workspaceId = await getWorkspaceId();

    const createResult = await apiPost(
        endpoints.modules.day_book.data_sources.addLocal,
        {
            workspaceId,
            name: name.trim(),
            sourceType: TYPE,
            method,
        }
    );
    const created = createResult?.data;
    if (!created?.dataSourceId) {
        throw new Error("No dataSourceId returned from server");
    }

    await apiPost(
        endpoints.modules.day_book.data_sources.confirmSchema(created.dataSourceId),
        {
            workspaceId,
            confirmedSchema,
            rawData,
        }
    );

    router.navigate("/modules/day-book/data-management");
    return created;
};

export const adapterDescriptor = {
    type: TYPE,
    category: "local-files",
    factory: createLocalCsvAdapter,
    wizard: {
        title: "Upload CSV",
        initialDraft: { method: "overwrite" },
        steps: [
            { key: "connect", title: "Upload", Component: CsvConnectStep },
            {
                key: "field-review",
                title: "Review fields",
                Component: FieldCategoryReviewStep,
                applies: (draft) => Boolean(draft.schemaPreview),
            },
            {
                key: "general-settings",
                title: "Settings",
                Component: GeneralSettingsStep,
                props: {
                    ExtraSettings: CsvSettingsExtra,
                    finaliseLabel: "Create Connection",
                },
            },
        ],
        finalise: finaliseLocalCsv,
    },
};
