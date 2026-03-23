import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, TextInput, Switch, Button, List, Divider, useTheme } from 'react-native-paper';
import ColorPicker from 'react-native-wheel-color-picker';
import CustomBottomSheet from '../BottomSheet';
import { 
    DEFAULT_BOARD_COLOUR, 
    BOARD_COLOUR_PALETTE 
} from '../../utils/boards/boardConstants';
import { 
    sanitizeColourValue, 
    isValidHexColour 
} from '../../utils/boards/boardUtils';

const DisplaySettingsSheet = ({ 
    visible, 
    item, 
    draft, 
    colourLabels,
    onClose, 
    onSave,
    onUpdateDraft,
    onResetColours,
    onResetAppearance
}) => {
    const theme = useTheme();
    const [showColourSheet, setShowColourSheet] = useState(false);
    const [showAppearanceSheet, setShowAppearanceSheet] = useState(false);
    const [colourPickerIndex, setColourPickerIndex] = useState(0);
    const [colourInputValue, setColourInputValue] = useState(DEFAULT_BOARD_COLOUR);
    const [colourInputError, setColourInputError] = useState(false);
    const colourInputFocusedRef = useRef(false);

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
    const subSheetDividerColor = theme.colors?.divider
        ?? theme.colors?.outline
        ?? 'rgba(0,0,0,0.08)';

    if (!visible || !item) return null;

    const handleColourSelection = (index) => {
        setColourPickerIndex(index);
        const currentColour = sanitizeColourValue(draft.colours[index]) 
            || draft.colours[index] 
            || BOARD_COLOUR_PALETTE[index % BOARD_COLOUR_PALETTE.length];
        setColourInputValue(currentColour || DEFAULT_BOARD_COLOUR);
        setColourInputError(false);
    };

    const handleColourInputChange = (text) => {
        setColourInputValue(text);
        if (colourInputFocusedRef.current && isValidHexColour(text)) {
            const sanitized = sanitizeColourValue(text);
            const updatedColours = [...draft.colours];
            updatedColours[colourPickerIndex] = sanitized;
            onUpdateDraft({ colours: updatedColours });
            setColourInputError(false);
        } else if (text && !isValidHexColour(text)) {
            setColourInputError(true);
        }
    };

    const handleColourWheelChange = (colour) => {
        if (!colourInputFocusedRef.current) {
            setColourInputValue(colour);
            const sanitized = sanitizeColourValue(colour);
            const updatedColours = [...draft.colours];
            updatedColours[colourPickerIndex] = sanitized;
            onUpdateDraft({ colours: updatedColours });
        }
    };

    const handleOpenColourSheet = () => {
        if (Array.isArray(draft.colours) && draft.colours.length > 0) {
            handleColourSelection(0);
            setShowColourSheet(true);
        }
    };

    const handleCloseColourSheet = () => {
        setShowColourSheet(false);
    };

    const handleOpenAppearanceSheet = () => {
        setShowAppearanceSheet(true);
    };

    const handleCloseAppearanceSheet = () => {
        setShowAppearanceSheet(false);
    };

    const handleSaveAndClose = () => {
        // Close any open sub-sheets first
        setShowColourSheet(false);
        setShowAppearanceSheet(false);
        // Then save
        onSave();
    };

    const handleCancelAndClose = () => {
        // Close any open sub-sheets first
        setShowColourSheet(false);
        setShowAppearanceSheet(false);
        // Then cancel
        onClose();
    };

    return (
        <>
            <CustomBottomSheet
                variant="standard"
                footer={{ variant: 'none' }}
                containerStyle={{ zIndex: 9999 }}
                header={{
                    title: 'Edit Display',
                    showClose: true,
                    actionLabel: 'Save',
                    onActionPress: handleSaveAndClose
                }}
                onChange={(index) => {
                    if (index === -1) onClose();
                }}
                onClose={handleCancelAndClose}
            >
                <View style={styles.container}>
                    <TextInput
                        label="Display name"
                        value={draft.label}
                        onChangeText={(text) => onUpdateDraft({ label: text })}
                        style={styles.input}
                        dense
                    />
                    
                    <Divider style={styles.divider} />

                    <TouchableOpacity
                        onPress={handleOpenColourSheet}
                        disabled={!Array.isArray(draft.colours) || draft.colours.length === 0}
                    >
                        <List.Item
                            title="Series Colours"
                            description={
                                Array.isArray(draft.colours) && draft.colours.length > 0
                                    ? `${draft.colours.length} colour${draft.colours.length > 1 ? 's' : ''} configured`
                                    : 'Add dependent variables to customize'
                            }
                            left={props => <List.Icon {...props} icon="palette" />}
                            right={props => Array.isArray(draft.colours) && draft.colours.length > 0 ? <List.Icon {...props} icon="chevron-right" /> : null}
                            disabled={!Array.isArray(draft.colours) || draft.colours.length === 0}
                        />
                    </TouchableOpacity>

                    <Divider style={styles.divider} />

                    <TouchableOpacity onPress={handleOpenAppearanceSheet}>
                        <List.Item
                            title="Chart Appearance"
                            description="Background, axis, and grid styling"
                            left={props => <List.Icon {...props} icon="format-paint" />}
                            right={props => <List.Icon {...props} icon="chevron-right" />}
                        />
                    </TouchableOpacity>
                </View>
            </CustomBottomSheet>

            {showColourSheet && (
                <CustomBottomSheet
                    variant="standard"
                    footer={{ variant: 'none' }}
                    containerStyle={{ zIndex: 10000 }}
                    header={{
                        title: 'Series Colours',
                        showClose: true,
                        actionLabel: 'Done',
                        onActionPress: handleCloseColourSheet
                    }}
                    onChange={(index) => {
                        if (index === -1) handleCloseColourSheet();
                    }}
                    onClose={handleCloseColourSheet}
                >
                    <ScrollView style={styles.subSheetContainer}>
                        {Array.isArray(draft.colours) && draft.colours.length > 0 ? (
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
                                                onPress={() => handleColourSelection(index)}
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
                                        onChangeText={handleColourInputChange}
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
                                        onColorChangeComplete={handleColourWheelChange}
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
                        ) : (
                            <View style={styles.emptyMessage}>
                                <Text style={styles.hintText}>
                                    Add dependent variables to customise series colours.
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </CustomBottomSheet>
            )}

            {showAppearanceSheet && (
                <CustomBottomSheet
                    variant="standard"
                    footer={{ variant: 'none' }}
                    containerStyle={{ zIndex: 10000 }}
                    header={{
                        title: 'Chart Appearance',
                        showClose: true,
                        actionLabel: 'Done',
                        onActionPress: handleCloseAppearanceSheet
                    }}
                    onChange={(index) => {
                        if (index === -1) handleCloseAppearanceSheet();
                    }}
                    onClose={handleCloseAppearanceSheet}
                >
                    <ScrollView style={styles.subSheetContainer}>
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
                    </ScrollView>
                </CustomBottomSheet>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 16
    },
    input: {
        marginBottom: 12
    },
    divider: {
        marginVertical: 8
    },
    subSheetContainer: {
        flex: 1,
        paddingHorizontal: 16
    },
    colourSheetContent: {
        paddingBottom: 16
    },
    appearanceSheetContent: {
        paddingBottom: 16
    },
    emptyMessage: {
        padding: 32,
        alignItems: 'center'
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
    },
    angleHint: {
        fontSize: 12,
        opacity: 0.6,
        marginTop: -6,
        marginBottom: 8,
        marginHorizontal: 4
    }
});

export default DisplaySettingsSheet;
