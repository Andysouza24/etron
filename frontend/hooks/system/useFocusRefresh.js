import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

// Loads list data when a screen gains focus: the first focus uses the
// cached-or-fetch `ensure`, and subsequent focuses call `refresh` to pick up
// changes made on other screens. `currentData` provides the fallback when
// `ensure` resolves nullish; `onResult` receives the loaded data each focus.
export default function useFocusRefresh({ ensure, refresh, currentData, onResult }) {
    const hasFocusedRef = useRef(false);
    const currentDataRef = useRef(currentData);

    useEffect(() => {
        currentDataRef.current = currentData;
    }, [currentData]);

    useFocusEffect(
        useCallback(() => {
            const sync = async () => {
                const loaded = hasFocusedRef.current
                    ? await refresh()
                    : (await ensure()) ?? currentDataRef.current;
                hasFocusedRef.current = true;
                await onResult?.(loaded);
            };
            sync();
        }, [ensure, refresh, onResult])
    );
}
