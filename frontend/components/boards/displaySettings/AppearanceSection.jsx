import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Switch, Button } from 'react-native-paper';

// Chart appearance settings: background/axis/tick/grid colours, x-axis label
// angle, and the show-grid toggle. Presentational; draft state lives in the parent.
const AppearanceSection = ({ draft, onUpdateDraft, onResetAppearance }) => {
    return (
        <View style={styles.appearanceSheetContent}>
            <View style={styles.row}>
                <TextInput
                    label="Background"
                    value={draft.background}
                    onChangeText={(text) => onUpdateDraft({ background: text })}
                    style={styles.inputHalf}
                    autoCapitalize="none"
                    autoCorrect={false}
                    dense
                />
                <TextInput
                    label="Axis"
                    value={draft.axisColor}
                    onChangeText={(text) => onUpdateDraft({ axisColor: text })}
                    style={styles.inputHalf}
                    autoCapitalize="none"
                    autoCorrect={false}
                    dense
                />
            </View>
            <View style={styles.row}>
                <TextInput
                    label="Tick labels"
                    value={draft.tickLabelColor}
                    onChangeText={(text) => onUpdateDraft({ tickLabelColor: text })}
                    style={styles.inputHalf}
                    autoCapitalize="none"
                    autoCorrect={false}
                    dense
                />
                <TextInput
                    label="Grid lines"
                    value={draft.gridColor}
                    onChangeText={(text) => onUpdateDraft({ gridColor: text })}
                    style={styles.inputHalf}
                    autoCapitalize="none"
                    autoCorrect={false}
                    dense
                />
            </View>
            <View style={styles.row}>
                <TextInput
                    label="X-axis label angle"
                    value={draft.xAxisLabelAngle ?? ''}
                    onChangeText={(text) => onUpdateDraft({ xAxisLabelAngle: text })}
                    style={styles.inputHalf}
                    autoCapitalize="none"
                    autoCorrect={false}
                    dense
                    placeholder="45"
                />
            </View>
            <Text style={styles.angleHint}>Enter a value between -90 and 90 degrees. Leave blank for default rotation.</Text>
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Show grid lines</Text>
                <Switch
                    value={draft.showGrid}
                    onValueChange={(value) => onUpdateDraft({ showGrid: value })}
                />
            </View>
            <Button
                mode="text"
                onPress={onResetAppearance}
                style={styles.resetButton}
                compact
            >
                Reset appearance
            </Button>
        </View>
    );
};

const styles = StyleSheet.create({
    appearanceSheetContent: {
        paddingBottom: 16
    },
    inputHalf: {
        flex: 1,
        marginHorizontal: 4
    },
    row: {
        flexDirection: 'row',
        marginBottom: 12,
        marginHorizontal: -4
    },
    resetButton: {
        alignSelf: 'flex-start',
        marginBottom: 4,
        marginTop: 4
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    switchLabel: {
        fontSize: 14
    },
    angleHint: {
        fontSize: 12,
        opacity: 0.6,
        marginTop: -6,
        marginBottom: 8,
        marginHorizontal: 4
    }
});

export default AppearanceSection;
