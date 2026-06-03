// shared field category review step
// wraps existing FieldCategoryReview component and writes user's confirmed schema back to wizard draft

import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import StackLayout from "../../../../../layout/StackLayout";
import BasicButton from "../../../../../common/buttons/BasicButton";
import FieldCategoryReview from "../../FieldCategoryReview";
import { useWizard } from "../WizardContext";

const FieldCategoryReviewStep = () => {
    const theme = useTheme();
    const { draft, setDraft, goNext, goBack, isFirst } = useWizard();
    const schemaPreview = draft.schemaPreview;

    const handleChange = useCallback(
        (schema) => {
            setDraft({ confirmedSchema: schema });
        },
        [setDraft]
    );

    if (!schemaPreview?.schema) {
        return (
            <View style={styles.empty}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                    No schema preview is available for this connection.
                </Text>
                <View style={styles.actions}>
                    {!isFirst && (
                        <BasicButton label="Back" onPress={goBack} mode="outlined" />
                    )}
                    <BasicButton label="Continue" onPress={goNext} />
                </View>
            </View>
        );
    }

    // empty source - no rows yet, so there are no fields to review
    // the connection is created without a schema and will be flagged for review when data first arrives
    if (schemaPreview.isEmpty || schemaPreview.schema.length === 0) {
        return (
            <View style={styles.empty}>
                <Text variant="titleMedium">No data yet</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                    This source is empty, so there are no fields to review. You can still
                    finish setting up the connection - we&apos;ll prompt you to review the
                    fields once data starts arriving.
                </Text>
                <View style={styles.actions}>
                    {!isFirst && (
                        <BasicButton label="Back" onPress={goBack} mode="outlined" />
                    )}
                    <BasicButton label="Continue" onPress={goNext} />
                </View>
            </View>
        );
    }

    const confirmed = draft.confirmedSchema || schemaPreview.schema;

    return (
        <StackLayout spacing={16}>
            <FieldCategoryReview
                schema={confirmed}
                sampleData={schemaPreview.sampleData || []}
                onChange={handleChange}
            />
            <View style={styles.actions}>
                {!isFirst && (
                    <BasicButton label="Back" onPress={goBack} mode="outlined" />
                )}
                <BasicButton
                    label="Continue"
                    onPress={goNext}
                    disabled={!confirmed?.length}
                />
            </View>
        </StackLayout>
    );
};

const styles = StyleSheet.create({
    empty: {
        gap: 12,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 12,
    },
});

export default FieldCategoryReviewStep;
