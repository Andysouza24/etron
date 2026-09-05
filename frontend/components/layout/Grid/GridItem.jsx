import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import useGridItem from '../../../hooks/boards/useGridItem';

const GridItem = ({
    id,
    position,
    isDraggable = true,
    isDragging = false,
    isResizing = false,
    resizeEnabled = false,
    isResizeTarget = false,
    onItemLongPress,
    onDragStart,
    onDragMove,
    onDragEnd,
    onResizeStart,
    onResizeMove,
    onResizeEnd,
    content,
    style,
    showDragHandle = false
}) => {
    const theme = useTheme();
    const outlineColor = theme.colors?.outline ?? 'rgba(0,0,0,0.12)';
    const resizeHighlightColor = theme.colors?.primary ?? '#6366f1';
    const resizeHandleFill = theme.colors?.focusedBackground
        ?? theme.colors?.lowOpacityButton
        ?? 'rgba(99, 102, 241, 0.25)';
    const resizeHandleBorder = theme.colors?.primary ?? 'rgba(99, 102, 241, 0.45)';
    const dragHandleBackground = theme.colors?.primary ?? 'rgba(99, 102, 241, 0.9)';
    const dragHandleGripColor = theme.colors?.onPrimary ?? theme.colors?.text ?? '#fff';

    const {
        isPressed,
        clearLongPressTimeout,
        panResponder,
        dragHandlePanResponder,
        resizePanResponders,
    } = useGridItem({
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
    });

    const isActive = isDragging || isPressed || isResizing || isResizeTarget;
    const shouldShowOutline = isActive;
    const outlineStrokeColor = isResizeTarget ? resizeHighlightColor : outlineColor;
    const outlineWidth = isResizeTarget ? 2 : 1;
    const isElevated = resizeEnabled || isResizing || isResizeTarget;
    const elevationLevel = isElevated ? (isActive ? 8 : 4) : 0;
    const shadowOpacity = isElevated ? (isActive ? 0.3 : 0.15) : 0;
    const shadowRadius = isElevated ? 4 : 0;
    const shadowOffset = isElevated ? { width: 0, height: 2 } : { width: 0, height: 0 };

    return (
        <View
            {...(isDraggable ? panResponder.panHandlers : {})}
            onTouchEndCapture={clearLongPressTimeout}
            onTouchCancel={clearLongPressTimeout}
            style={[
                styles.item,
                {
                    left: position.x,
                    top: position.y,
                    width: position.width,
                    height: position.height,
                    backgroundColor: theme.colors.surface,
                    borderColor: shouldShowOutline ? outlineStrokeColor : 'transparent',
                    borderWidth: shouldShowOutline ? outlineWidth : 0,
                    elevation: elevationLevel,
                    shadowOpacity,
                    shadowRadius,
                    shadowOffset,
                    zIndex: isActive ? 100 : 1
                },
                style
            ]}
        >
            <View style={styles.content}>
                {content}
            </View>
            {showDragHandle && dragHandlePanResponder && (
                <View
                    {...dragHandlePanResponder.panHandlers}
                    style={[styles.dragHandle, { backgroundColor: dragHandleBackground }]}
                >
                    <View style={[styles.dragHandleGrip, { backgroundColor: dragHandleGripColor }]} />
                    <View style={[styles.dragHandleGrip, styles.dragHandleGripLower, { backgroundColor: dragHandleGripColor }]} />
                </View>
            )}
            {resizeEnabled && resizePanResponders && (
                <View pointerEvents="box-none" style={styles.resizeOverlay}>
                    <View
                        {...resizePanResponders.e.panHandlers}
                        style={[styles.resizeHitArea, styles.hitAreaEast]}
                    >
                        <View
                            pointerEvents="none"
                            style={[styles.resizeHandle, styles.handleEast, {
                                backgroundColor: resizeHandleFill,
                                borderColor: resizeHandleBorder
                            }]}
                        />
                    </View>
                    <View
                        {...resizePanResponders.s.panHandlers}
                        style={[styles.resizeHitArea, styles.hitAreaSouth]}
                    >
                        <View
                            pointerEvents="none"
                            style={[styles.resizeHandle, styles.handleSouth, {
                                backgroundColor: resizeHandleFill,
                                borderColor: resizeHandleBorder
                            }]}
                        />
                    </View>
                    <View
                        {...resizePanResponders.se.panHandlers}
                        style={[styles.resizeHitArea, styles.hitAreaCorner]}
                    >
                        <View
                            pointerEvents="none"
                            style={[styles.resizeHandle, styles.handleCorner, {
                                backgroundColor: resizeHandleFill,
                                borderColor: resizeHandleBorder
                            }]}
                        />
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    item: {
        position: 'absolute',
        borderRadius: 8,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4
    },
    content: {
        flex: 1
    },
    resizeOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 20,
        pointerEvents: 'box-none'
    },
    resizeHandle: {
        position: 'absolute',
        borderWidth: 1,
        borderRadius: 6
    },
    resizeHitArea: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent'
    },
    hitAreaEast: {
        width: 32,
        right: -16,
        top: '15%',
        bottom: '15%'
    },
    hitAreaSouth: {
        height: 32,
        bottom: -16,
        left: '15%',
        right: '15%'
    },
    hitAreaCorner: {
        width: 44,
        height: 44,
        right: -22,
        bottom: -22
    },
    handleEast: {
        width: 12,
        height: '70%',
        position: 'relative'
    },
    handleSouth: {
        height: 12,
        width: '70%',
        position: 'relative'
    },
    handleCorner: {
        width: 18,
        height: 18,
        position: 'absolute',
        right: 13,
        bottom: 13
    },
    dragHandle: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 25
    },
    dragHandleGrip: {
        width: 14,
        height: 3,
        borderRadius: 2,
        opacity: 0.9
    },
    dragHandleGripLower: {
        marginTop: 3
    }
});

export default GridItem;
