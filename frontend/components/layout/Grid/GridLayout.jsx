import React from 'react';
import { View, StyleSheet } from 'react-native';
import GridItem from './GridItem';
import useGridLayout from '../../../hooks/boards/useGridLayout';

const GridLayout = ({
    items = [],
    cols = 12,
    rowHeight = 100,
    margin = [10, 10],
    isDraggable = true,
    isResizable = false,
    activeResizeItemId = null,
    onItemLongPress,
    onBackgroundPress,
    onResizeSessionEnd,
    onLayoutChange,
    containerStyle,
    containerWidth
}) => {
    const {
        layout,
        itemMap,
        width,
        containerHeight,
        previewHighlightPosition,
        dragPreview,
        resizePreview,
        draggingId,
        resizingId,
        getItemPosition,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        handleResizeStart,
        handleResizeMove,
        handleResizeEnd,
        shouldHandleBackgroundTouch,
        handleBackgroundRelease,
    } = useGridLayout({
        items,
        cols,
        rowHeight,
        margin,
        isResizable,
        activeResizeItemId,
        onBackgroundPress,
        onResizeSessionEnd,
        onLayoutChange,
        containerWidth,
    });

    return (
        <View
            style={[styles.container, { height: containerHeight, width }, containerStyle]}
            onStartShouldSetResponder={shouldHandleBackgroundTouch}
            onResponderRelease={handleBackgroundRelease}
        >
            {previewHighlightPosition && (
                <View
                    pointerEvents="none"
                    style={[
                        styles.snapHighlight,
                        {
                            left: previewHighlightPosition.x,
                            top: previewHighlightPosition.y,
                            width: previewHighlightPosition.width,
                            height: previewHighlightPosition.height
                        }
                    ]}
                />
            )}
            {layout.map(item => {
                const sourceItem = itemMap.get(item.id);
                if (!sourceItem) {
                    return null;
                }

                const preview = dragPreview && dragPreview.id === item.id ? dragPreview : null;
                const sizePreview = resizePreview && resizePreview.id === item.id ? resizePreview : null;
                const displayItem = {
                    ...item,
                    ...(preview ? { x: preview.x, y: preview.y } : null),
                    ...(sizePreview ? { w: sizePreview.w, h: sizePreview.h } : null)
                };
                const position = getItemPosition(displayItem);
                const isItemResizeTarget = activeResizeItemId === item.id;
                const itemResizeEnabled = isResizable && isItemResizeTarget && !!sourceItem.resizeConstraints;
                const itemDraggable = isDraggable && !isItemResizeTarget;

                return (
                    <GridItem
                        key={item.id}
                        id={item.id}
                        position={position}
                        isDraggable={itemDraggable}
                        isDragging={draggingId === item.id}
                        isResizing={resizingId === item.id}
                        resizeEnabled={itemResizeEnabled}
                        isResizeTarget={isItemResizeTarget}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        onResizeStart={handleResizeStart}
                        onResizeMove={handleResizeMove}
                        onResizeEnd={handleResizeEnd}
                        onItemLongPress={onItemLongPress}
                        showDragHandle={isItemResizeTarget}
                        content={sourceItem.content}
                        style={sourceItem.style}
                    />
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        backgroundColor: 'transparent'
    },
    snapHighlight: {
        position: 'absolute',
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.14)'
    }
});

export default GridLayout;
