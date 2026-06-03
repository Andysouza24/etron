import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput, List, Divider } from 'react-native-paper';
import CustomBottomSheet from '../BottomSheet';
import useDisplaySettingsForm from '../../hooks/boards/useDisplaySettingsForm';
import ColoursSection from './displaySettings/ColoursSection';
import AppearanceSection from './displaySettings/AppearanceSection';

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
    const {
        showColourSheet,
        showAppearanceSheet,
        colourPickerIndex,
        colourInputValue,
        colourInputError,
        colourInputFocusedRef,
        handleColourSelection,
        handleColourInputChange,
        handleColourWheelChange,
        handleOpenColourSheet,
        handleCloseColourSheet,
        handleOpenAppearanceSheet,
        handleCloseAppearanceSheet,
        handleSaveAndClose,
        handleCancelAndClose,
    } = useDisplaySettingsForm({ draft, onUpdateDraft, onSave, onClose });

    if (!visible || !item) return null;

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
                        <ColoursSection
                            draft={draft}
                            colourLabels={colourLabels}
                            colourPickerIndex={colourPickerIndex}
                            colourInputValue={colourInputValue}
                            colourInputError={colourInputError}
                            colourInputFocusedRef={colourInputFocusedRef}
                            onSelectColour={handleColourSelection}
                            onColourInputChange={handleColourInputChange}
                            onColourWheelChange={handleColourWheelChange}
                            onResetColours={onResetColours}
                        />
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
                        <AppearanceSection
                            draft={draft}
                            onUpdateDraft={onUpdateDraft}
                            onResetAppearance={onResetAppearance}
                        />
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
    }
});

export default DisplaySettingsSheet;
