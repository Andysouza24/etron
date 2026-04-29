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
