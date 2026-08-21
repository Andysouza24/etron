import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { PanResponder } from 'react-native';

const MOVE_ACTIVATION_DISTANCE = 6;
const LONG_PRESS_DURATION = 450;

// Drag/resize gesture state machine for a single grid item. Owns the three
// PanResponders (body drag, drag handle, resize handles), the long-press
// timer, and the pressed flag. The component consumes the returned handlers
// and derives its own visual state from isPressed plus its props.
export default function useGridItem({
    id,
    position,
    isDraggable,
    showDragHandle,
    resizeEnabled,
    onItemLongPress,
    onDragStart,
    onDragMove,
    onDragEnd,
    onResizeStart,
    onResizeMove,
    onResizeEnd,
}) {
    const [isPressed, setIsPressed] = useState(false);
    const positionRef = useRef(position);

    const longPressTimeoutRef = useRef(null);
    const longPressTriggeredRef = useRef(false);

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    useEffect(() => () => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    }, []);

    const clearLongPressTimeout = useCallback(() => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    }, []);

    const startLongPressTimer = useCallback(() => {
        if (!onItemLongPress) return;
        clearLongPressTimeout();
        longPressTriggeredRef.current = false;
        longPressTimeoutRef.current = setTimeout(() => {
            longPressTimeoutRef.current = null;
            longPressTriggeredRef.current = true;
            onItemLongPress?.(id);
        }, LONG_PRESS_DURATION);
    }, [clearLongPressTimeout, id, onItemLongPress]);

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
            if (onItemLongPress) {
                startLongPressTimer();
            }
            return false;
        },
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
            const movedFarEnough =
                Math.abs(gestureState.dx) > MOVE_ACTIVATION_DISTANCE ||
                Math.abs(gestureState.dy) > MOVE_ACTIVATION_DISTANCE;

            if (movedFarEnough) {
                clearLongPressTimeout();
            }

            if (!isDraggable) return false;
            if (longPressTriggeredRef.current) return false;

            return movedFarEnough;
        },

        onPanResponderGrant: () => {
            clearLongPressTimeout();
            if (!isDraggable || longPressTriggeredRef.current) return;
            if (!isDraggable) return;
            setIsPressed(true);
            onDragStart?.(id, positionRef.current);
        },

        onPanResponderMove: (_, gestureState) => {
            if (!isDraggable || longPressTriggeredRef.current) return;
            onDragMove?.(id, gestureState.dx, gestureState.dy);
        },

        onPanResponderTerminationRequest: () => false,

        onPanResponderRelease: () => {
            clearLongPressTimeout();
            if (longPressTriggeredRef.current) {
                longPressTriggeredRef.current = false;
                return;
            }
            if (!isDraggable) return;
            setIsPressed(false);
            onDragEnd?.(id);
        },

        onPanResponderTerminate: () => {
            clearLongPressTimeout();
            if (longPressTriggeredRef.current) {
                longPressTriggeredRef.current = false;
                return;
            }
            if (!isDraggable) return;
            setIsPressed(false);
            onDragEnd?.(id);
        }
    }), [clearLongPressTimeout, id, isDraggable, onDragEnd, onDragMove, onDragStart, onItemLongPress, startLongPressTimer]);

    const dragHandlePanResponder = useMemo(() => {
        if (!showDragHandle) {
            return null;
        }

        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                clearLongPressTimeout();
                setIsPressed(true);
                onDragStart?.(id, positionRef.current);
            },
            onPanResponderMove: (_, gestureState) => {
                onDragMove?.(id, gestureState.dx, gestureState.dy);
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderRelease: () => {
                setIsPressed(false);
                onDragEnd?.(id);
            },
            onPanResponderTerminate: () => {
                setIsPressed(false);
                onDragEnd?.(id);
            }
        });
    }, [clearLongPressTimeout, showDragHandle, id, onDragStart, onDragMove, onDragEnd]);

    const resizePanResponders = useMemo(() => {
        if (!resizeEnabled) {
            return null;
        }

        const createResponder = (direction) => PanResponder.create({
            onStartShouldSetPanResponder: () => resizeEnabled,
            onMoveShouldSetPanResponder: () => resizeEnabled,
            onPanResponderGrant: () => {
                onResizeStart?.(id, direction, positionRef.current);
            },
            onPanResponderMove: (_, gestureState) => {
                onResizeMove?.(id, direction, gestureState.dx, gestureState.dy);
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderRelease: () => {
                onResizeEnd?.(id, direction);
            },
            onPanResponderTerminate: () => {
                onResizeEnd?.(id, direction);
            }
        });

        return {
            e: createResponder('e'),
            s: createResponder('s'),
            se: createResponder('se')
        };
    }, [resizeEnabled, id, onResizeStart, onResizeMove, onResizeEnd]);

    return {
        isPressed,
        clearLongPressTimeout,
        panResponder,
        dragHandlePanResponder,
        resizePanResponders,
    };
}
