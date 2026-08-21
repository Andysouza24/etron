import { useState, useCallback } from 'react';
import { Keyboard } from 'react-native';
import { getMaxIndex } from './utils';

// Search-filter state for the sheet: the query, the active/focused flag, and a
// reset key. Owns focus/blur and backdrop-press behaviour, including expanding
// the sheet to its max snap point on focus when configured.
export default function useSheetSearch({
    bottomSheetRef,
    autoExpandOnSearchFocus,
    enableDynamicSizing,
    snapPointsLength,
}) {
    const [searchActive, setSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResetKey, setSearchResetKey] = useState(0);

    const clearSearchState = useCallback(() => {
        setSearchActive(false);
        setSearchQuery('');
        setSearchResetKey((prev) => prev + 1);
    }, []);

    const handleSearchFocus = useCallback(() => {
        setSearchActive(true);
        if (autoExpandOnSearchFocus) {
            bottomSheetRef.current?.snapToIndex?.(getMaxIndex(enableDynamicSizing, snapPointsLength));
        }
    }, [autoExpandOnSearchFocus, bottomSheetRef, enableDynamicSizing, snapPointsLength]);

    const handleSearchBlur = useCallback(() => {
        setSearchActive(false);
    }, []);

    const handleBackdropPress = useCallback(() => {
        if (searchActive) {
            Keyboard.dismiss();
            setSearchActive(false);
            return;
        }
        bottomSheetRef.current?.snapToIndex?.(0);
    }, [searchActive, bottomSheetRef]);

    return {
        searchActive,
        searchQuery,
        setSearchQuery,
        searchResetKey,
        clearSearchState,
        handleSearchFocus,
        handleSearchBlur,
        handleBackdropPress,
    };
}
