import { useState, useRef } from 'react';
import {
    DEFAULT_BOARD_COLOUR,
    BOARD_COLOUR_PALETTE
} from '../../utils/boards/boardConstants';
import {
    sanitizeColourValue,
    isValidHexColour
} from '../../utils/boards/boardUtils';

// Local editing state for the display-settings sheet: sub-sheet visibility and
// the series-colour picker (selected index, hex input, validation). The draft
// itself is owned by the parent and mutated through onUpdateDraft.
export default function useDisplaySettingsForm({ draft, onUpdateDraft, onSave, onClose }) {
    const [showColourSheet, setShowColourSheet] = useState(false);
    const [showAppearanceSheet, setShowAppearanceSheet] = useState(false);
    const [colourPickerIndex, setColourPickerIndex] = useState(0);
    const [colourInputValue, setColourInputValue] = useState(DEFAULT_BOARD_COLOUR);
    const [colourInputError, setColourInputError] = useState(false);
    const colourInputFocusedRef = useRef(false);

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

    return {
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
    };
}
