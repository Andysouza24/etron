import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, useTheme } from 'react-native-paper';
import ColorPicker from 'react-native-wheel-color-picker';
import {
    DEFAULT_BOARD_COLOUR,
    BOARD_COLOUR_PALETTE
} from '../../../utils/boards/boardConstants';
import {
    sanitizeColourValue,
    isValidHexColour
} from '../../../utils/boards/boardUtils';

// Series-colour editor: per-series chips, a hex text input, and a colour wheel.
// Presentational; the selection state and change handlers are owned by the parent.
const ColoursSection = ({
    draft,
    colourLabels,
    colourPickerIndex,
    colourInputValue,
    colourInputError,
    colourInputFocusedRef,
    onSelectColour,
    onColourInputChange,
    onColourWheelChange,
    onResetColours,
}) => {
    const theme = useTheme();

    const primaryColor = theme.colors?.primary ?? '#6200ee';
    const chipBorderColor = primaryColor;
    const chipBackgroundColor = theme.colors?.focusedBackground
        ?? theme.colors?.lowOpacityButton
        ?? theme.colors?.buttonBackground
        ?? 'rgba(98,0,238,0.08)';
    const chipSelectedBackground = theme.colors?.buttonBackground
        ?? theme.colors?.focusedBackground
        ?? 'rgba(98,0,238,0.18)';
    const swatchBorderColor = theme.colors?.outline ?? 'rgba(255,255,255,0.4)';
    const previewBorderColor = theme.colors?.outline ?? 'rgba(255,255,255,0.35)';

    if (!(Array.isArray(draft.colours) && draft.colours.length > 0)) {
        return (
            <View style={styles.emptyMessage}>
                <Text style={styles.hintText}>
                    Add dependent variables to customise series colours.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.colourSheetContent}>
            <View style={styles.colourChipRow}>
                {colourLabels.map((label, index) => {
                    const colourValue = sanitizeColourValue(draft.colours[index])
                        || draft.colours[index]
                        || BOARD_COLOUR_PALETTE[index % BOARD_COLOUR_PALETTE.length];
                    const isSelected = colourPickerIndex === index;

                    return (
                        <TouchableOpacity
                            key={`${label}-${index}`}
                            onPress={() => onSelectColour(index)}
                            activeOpacity={0.85}
                            style={[
                                styles.colourChip,
                                {
                                    borderColor: chipBorderColor,
                                    backgroundColor: chipBackgroundColor
                                },
                                isSelected && {
                                    borderColor: primaryColor,
                                    backgroundColor: chipSelectedBackground
                                }
                            ]}
                        >
                            <View style={[
                                styles.colourSwatch,
                                {
                                    backgroundColor: colourValue || DEFAULT_BOARD_COLOUR,
                                    borderColor: swatchBorderColor
                                }
                            ]} />
                            <Text style={styles.colourChipLabel} numberOfLines={1}>
                                {label || `S${index + 1}`}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.colourInputRow}>
                <View
                    style={[
                        styles.colourPreview,
                        {
                            backgroundColor: isValidHexColour(colourInputValue)
                                ? colourInputValue
                                : DEFAULT_BOARD_COLOUR,
                            borderColor: previewBorderColor
                        }
                    ]}
                />
                <TextInput
                    label={`${colourLabels[colourPickerIndex] || `S${colourPickerIndex + 1}`} hex`}
                    value={colourInputValue}
                    onChangeText={onColourInputChange}
                    onFocus={() => { colourInputFocusedRef.current = true; }}
                    onBlur={() => { colourInputFocusedRef.current = false; }}
                    style={styles.colourTextInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    error={colourInputError}
                    dense
                />
            </View>

            <View style={styles.colourPickerWrapper}>
                <ColorPicker
                    color={isValidHexColour(colourInputValue) ? colourInputValue : DEFAULT_BOARD_COLOUR}
                    onColorChangeComplete={onColourWheelChange}
                    onColorChange={() => {}}
                    thumbSize={20}
                    sliderSize={20}
                    gapSize={8}
                    noSnap
                    style={styles.colourPicker}
                    palette={BOARD_COLOUR_PALETTE}
                />
            </View>

            <Button
                mode="text"
                onPress={onResetColours}
                style={styles.resetButton}
                compact
            >
                Reset colours
            </Button>
        </View>
    );
};

const styles = StyleSheet.create({
    colourSheetContent: {
        paddingBottom: 16
    },
    emptyMessage: {
        padding: 32,
        alignItems: 'center'
    },
    resetButton: {
        alignSelf: 'flex-start',
        marginBottom: 4,
        marginTop: 4
    },
    hintText: {
        fontSize: 12,
        opacity: 0.6,
        marginBottom: 8,
        textAlign: 'center'
    },
    colourChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -3,
        marginBottom: 8
    },
    colourChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginHorizontal: 3,
        marginBottom: 6
    },
    colourSwatch: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: 6,
        borderWidth: 1
    },
    colourChipLabel: {
        fontSize: 12,
        fontWeight: '500'
    },
    colourInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    colourPreview: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        marginRight: 10
    },
    colourTextInput: {
        flex: 1
    },
    colourPickerWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
        marginBottom: 8
    },
    colourPicker: {
        width: 160,
        height: 160
    }
});

export default ColoursSection;
