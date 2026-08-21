import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Tracks the on-screen keyboard height. Returns the current keyboard
// height so the sheet can adjust its max content size. With keyboardBehavior="interactive",
// the sheet automatically adjusts to keep focused input visible above the keyboard.
export default function useSheetKeyboard({ bottomSheetRef, autoExpandOnKeyboardShow }) {
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const keyboardShowListener = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });

        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    return keyboardHeight;
}
