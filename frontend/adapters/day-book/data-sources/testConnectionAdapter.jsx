// frontend adapter for the temporary "test-connection" connection type
// mirrors micromax-dashboard but reads from `test-exports/` instead of `exports/`

import { router } from "expo-router";

import { apiPost } from "../../../utils/api/apiClient";
import endpoints from "../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../storage/workspaceStorage";

import MicromaxConnectStep from "./micromax/wizard-steps/MicromaxConnectStep";
import MicromaxChildrenReviewStep from "./micromax/wizard-steps/MicromaxChildrenReviewStep";
import GeneralSettingsStep from "../../../components/modules/day-book/data-sources/wizard/steps/GeneralSettingsStep";

const SOURCE_TYPE = "test-connection";
const DISPLAY_NAME = "Test Connection";
const EXPORT_PREFIX = "test-exports/";
const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.json$/;

const buildObjectKey = (fileName) => {
  if (!fileName || !FILE_NAME_PATTERN.test(fileName)) {
    throw new Error("fileName must match /^[A-Za-z0-9._-]+\\.json$/");
  }
  return `${EXPORT_PREFIX}${fileName}`;
};

const parseObjectKey = (key) => {
  if (!key || !key.startsWith(EXPORT_PREFIX)) return null;
  const fileName = key.slice(EXPORT_PREFIX.length);
  if (!fileName || fileName.includes("/")) return null;
  if (!FILE_NAME_PATTERN.test(fileName)) return null;
  return { fileName };
};

export const createTestConnectionAdapter = (
  authService,
  apiClient,
  options = {}
) => {
  let currentConnection = null;
  let isConnected = false;

  const connect = async (connectionData = {}) => {
    const newConnection = {
      id: `test-connection_${Date.now()}`,
      name: connectionData.name || DISPLAY_NAME,
      status: "connected",
      createdAt: new Date().toISOString(),
    };
    currentConnection = newConnection;
    isConnected = true;
    return { connected: true, connection: currentConnection };
  };

  const disconnect = async () => {
    currentConnection = null;
    isConnected = false;
    return { connected: true };
  };

  const testConnection = async () => ({
    status: "success",
    sampleData: {
      message:
        "Test Connection has no local endpoint. Files are imported automatically.",
      timestamp: new Date().toISOString(),
    },
  });

  const getDataSources = async () => {
    if (!isConnected) {
      throw new Error("Not connected to Test Connection");
    }
    return [];
  };

  const fetchRawData = async () => {
    throw new Error(
      "Test Connection parent holds no data; fetch from a child file data source instead."
    );
  };

  return {
    type: SOURCE_TYPE,
    connect,
    disconnect,
    testConnection,
    getDataSources,
    fetchRawData,
    getCurrentConnection: () => currentConnection,
    isConnected: () => isConnected,
    EXPORT_PREFIX,
    FILE_NAME_PATTERN,
    buildObjectKey,
    parseObjectKey,
  };
};

export {
  SOURCE_TYPE,
  EXPORT_PREFIX,
  FILE_NAME_PATTERN,
  buildObjectKey,
  parseObjectKey,
};

export const adapterDescriptor = {
  type: SOURCE_TYPE,
  category: "test-connection",
  factory: createTestConnectionAdapter,
  wizard: {
    title: DISPLAY_NAME,
    initialDraft: {},
    steps: [
      {
        key: "connect",
        title: "Connect",
        Component: MicromaxConnectStep,
        props: {
          sourceType: SOURCE_TYPE,
          displayName: DISPLAY_NAME,
          description:
            "Connect Test Connection. Each export file in the test-exports folder becomes its own data source. If any files don't have a standard configuration yet, you'll be asked to review their fields after connecting.",
          discoverEndpoint:
            endpoints.modules.day_book.data_sources.discoverTestConnection,
        },
      },
      {
        key: "children-review",
        title: "Review files",
        Component: MicromaxChildrenReviewStep,
        applies: (draft) =>
          Boolean(draft.dataSourceId) &&
          (draft.children || []).some((c) => c?.status === "pending_setup"),
      },
      {
        key: "general-settings",
        title: "Settings",
        Component: GeneralSettingsStep,
        props: { finaliseLabel: "Finish setup" },
      },
    ],
    finalise: async (draft) => {
      if (!draft.dataSourceId) throw new Error("Setup has not started yet");
      const workspaceId = await getWorkspaceId();
      await apiPost(
        endpoints.modules.day_book.data_sources.activate(draft.dataSourceId),
        { workspaceId, name: (draft.name || DISPLAY_NAME).trim() }
      );
      router.navigate("/modules/day-book/data-management");
      return { dataSourceId: draft.dataSourceId };
    },
  },
};
