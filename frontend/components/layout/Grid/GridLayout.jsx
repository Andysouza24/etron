import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import GridItem from './GridItem';

const mapToLayoutItems = (items = []) =>
    items.map(item => ({
        id: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h
    }));

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
    const [layout, setLayout] = useState(() => mapToLayoutItems(items));
    const [draggingId, setDraggingId] = useState(null);
    const [dragPreview, setDragPreview] = useState(null);
    const [resizingId, setResizingId] = useState(null);
    const [resizePreview, setResizePreview] = useState(null);
    const prevItemsRef = useRef(items);
    const layoutRef = useRef(layout);
    const dragPreviewRef = useRef(null);
    const dragStateRef = useRef(null);
    const resizePreviewRef = useRef(null);
    const resizeStateRef = useRef(null);

    const updateLayoutState = useCallback((updater) => {
        setLayout(prevLayout => {
            const nextLayout = typeof updater === 'function' ? updater(prevLayout) : updater;
            layoutRef.current = nextLayout;
            return nextLayout;
        });
    }, []);

    useEffect(() => {
        dragPreviewRef.current = dragPreview;
    }, [dragPreview]);

    useEffect(() => {
        resizePreviewRef.current = resizePreview;
    }, [resizePreview]);

    useEffect(() => {
        layoutRef.current = layout;
    }, [layout]);

    useEffect(() => {
        if (draggingId || resizingId) {
            prevItemsRef.current = items;
            return;
        }

        const prevItems = prevItemsRef.current;
        const prevMap = new Map(prevItems.map(item => [item.id, item]));
        let hasDifference = items.length !== prevItems.length;

        if (!hasDifference) {
            for (const item of items) {
                const prevItem = prevMap.get(item.id);
                if (!prevItem ||
                    prevItem.x !== item.x ||
                    prevItem.y !== item.y ||
                    prevItem.w !== item.w ||
                    prevItem.h !== item.h) {
                    hasDifference = true;
                    break;
                }
            }
        }

        if (hasDifference) {
            const mappedLayout = mapToLayoutItems(items);
            layoutRef.current = mappedLayout;
            setLayout(mappedLayout);
        }

        prevItemsRef.current = items;
    }, [items, draggingId, resizingId]);

    const itemMap = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);

    const screenWidth = Dimensions.get('window').width;
    const width = typeof containerWidth === 'number' ? containerWidth : screenWidth;

    const [marginX, marginY] = Array.isArray(margin) ? margin : [margin, margin];

    const colWidth = useMemo(() => {
        const availableWidth = width - marginX * Math.max(0, cols - 1);
        return cols > 0 ? Math.max(0, availableWidth / cols) : 0;
    }, [width, cols, marginX]);

    const getItemPosition = useCallback((item) => ({
        x: item.x * (colWidth + marginX),
        y: item.y * (rowHeight + marginY),
        width: item.w * colWidth + Math.max(0, item.w - 1) * marginX,
        height: item.h * rowHeight + Math.max(0, item.h - 1) * marginY
    }), [colWidth, rowHeight, marginX, marginY]);

    const getGridPositionFromPixels = useCallback((pixelX, pixelY) => {
        const colUnit = colWidth + marginX;
        const rowUnit = rowHeight + marginY;

        if (colUnit <= 0 || rowUnit <= 0) {
            return {
                rawX: 0,
                rawY: 0,
                snappedX: 0,
                snappedY: 0
            };
        }

        const rawX = pixelX / colUnit;
        const rawY = pixelY / rowUnit;

        return {
            rawX,
            rawY,
            snappedX: Math.round(rawX),
            snappedY: Math.round(rawY)
        };
    }, [colWidth, marginX, rowHeight, marginY]);

    const hasCollision = useCallback((item, newX, newY, excludeId = null, sizeOverride) => {
        const currentLayout = layoutRef.current;
        const width = sizeOverride?.w ?? item.w;
        const height = sizeOverride?.h ?? item.h;

        return currentLayout.some(layoutItem => {
            if (layoutItem.id === excludeId) return false;
            
            const itemRight = newX + width;
            const itemBottom = newY + height;
            const layoutRight = layoutItem.x + layoutItem.w;
            const layoutBottom = layoutItem.y + layoutItem.h;

            return !(newX >= layoutRight || itemRight <= layoutItem.x || 
                     newY >= layoutBottom || itemBottom <= layoutItem.y);
        });
    }, []);

    const handleDragStart = useCallback((id, position) => {
        const item = layoutRef.current.find(i => i.id === id);
        if (!item) return;

        setDraggingId(id);
        dragStateRef.current = {
            id,
            item,
            originPx: { x: position.x, y: position.y }
        };
        const initialPreview = { id, x: item.x, y: item.y, snappedX: item.x, snappedY: item.y };
        dragPreviewRef.current = initialPreview;
        setDragPreview(initialPreview);
    }, []);

    const handleDragMove = useCallback((id, dx, dy) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.id !== id) return;

        const { item, originPx } = dragState;
        const pixelX = originPx.x + dx;
        const pixelY = originPx.y + dy;

        const gridPos = getGridPositionFromPixels(pixelX, pixelY);
    const clampedRawX = Math.max(0, Math.min(gridPos.rawX, cols - item.w));
    const clampedRawY = Math.max(0, gridPos.rawY);
    const snappedX = Math.max(0, Math.min(Math.round(clampedRawX), cols - item.w));
    const snappedY = Math.max(0, Math.round(clampedRawY));

        const currentPreview = dragPreviewRef.current;
        if (
            currentPreview &&
            currentPreview.id === id &&
            Math.abs(currentPreview.x - clampedRawX) < 0.01 &&
            Math.abs(currentPreview.y - clampedRawY) < 0.01
        ) {
            return;
        }

        const nextPreview = { id, x: clampedRawX, y: clampedRawY, snappedX, snappedY };
        dragPreviewRef.current = nextPreview;

        setDragPreview(prev => {
            if (
                prev &&
                prev.id === id &&
                Math.abs(prev.x - clampedRawX) < 0.01 &&
                Math.abs(prev.y - clampedRawY) < 0.01
            ) {
                return prev;
            }
            return nextPreview;
        });
    }, [cols, getGridPositionFromPixels]);

    const handleDragEnd = useCallback((id) => {
        const dragState = dragStateRef.current;
        const preview = dragPreviewRef.current;

        dragStateRef.current = null;
        setDraggingId(null);

        if (!dragState) {
            dragPreviewRef.current = null;
            setDragPreview(null);
            return;
        }

        if (!preview || preview.id !== id) {
            dragPreviewRef.current = null;
            setDragPreview(null);
            return;
        }

        const { item } = dragState;

        const targetX = Math.max(0, Math.min(Math.round(preview.snappedX ?? preview.x), cols - item.w));
        const targetY = Math.max(0, Math.round(preview.snappedY ?? preview.y));

        if (hasCollision(item, targetX, targetY, id)) {
            dragPreviewRef.current = null;
            setDragPreview(null);
            return;
        }

        if (targetX === item.x && targetY === item.y) {
            dragPreviewRef.current = null;
            setDragPreview(null);
            return;
        }

        updateLayoutState(prevLayout => prevLayout.map(layoutItem =>
            layoutItem.id === id ? { ...layoutItem, x: targetX, y: targetY } : layoutItem
        ));

        dragPreviewRef.current = null;
        setDragPreview(null);
        setTimeout(() => {
            onLayoutChange?.(layoutRef.current);
        }, 0);
    }, [hasCollision, onLayoutChange, updateLayoutState]);

    const handleResizeStart = useCallback((id, direction) => {
        if (activeResizeItemId !== id) {
            return;
        }

        const item = layoutRef.current.find(i => i.id === id);
        if (!item) return;

        const sourceItem = itemMap.get(id);
        const constraints = sourceItem?.resizeConstraints || {};

        const minWidth = Math.max(constraints.minWidth ?? item.w, 1);
        const minHeight = Math.max(constraints.minHeight ?? item.h, 1);
        const maxWidth = Math.max(minWidth, constraints.maxWidth ?? (cols - item.x));
        const maxHeight = Math.max(minHeight, constraints.maxHeight ?? Number.POSITIVE_INFINITY);

        resizeStateRef.current = {
            id,
            item,
            direction,
            originSize: { width: item.w, height: item.h },
            constraints: { minWidth, minHeight, maxWidth, maxHeight }
        };

        const initialPreview = {
            id,
            w: item.w,
            h: item.h,
            snappedW: item.w,
            snappedH: item.h
        };

        setResizingId(id);
        resizePreviewRef.current = initialPreview;
        setResizePreview(initialPreview);
    }, [activeResizeItemId, cols, itemMap]);

    const handleResizeMove = useCallback((id, direction, dx, dy) => {
        const resizeState = resizeStateRef.current;
        if (!resizeState || resizeState.id !== id) return;

        const { item, originSize, constraints } = resizeState;
        const colUnit = colWidth + marginX;
        const rowUnit = rowHeight + marginY;

        let rawWidth = originSize.width;
        let rawHeight = originSize.height;

        if (direction.includes('e') && colUnit > 0) {
            rawWidth = originSize.width + dx / colUnit;
        }

        if (direction.includes('s') && rowUnit > 0) {
            rawHeight = originSize.height + dy / rowUnit;
        }

        rawWidth = Math.max(constraints.minWidth, Math.min(rawWidth, constraints.maxWidth, cols - item.x));
        rawHeight = Math.max(constraints.minHeight, Math.min(rawHeight, constraints.maxHeight));

        let snappedW = Math.max(constraints.minWidth, Math.round(rawWidth));
        let snappedH = Math.max(constraints.minHeight, Math.round(rawHeight));

        if (hasCollision(item, item.x, item.y, id, { w: snappedW, h: snappedH })) {
            if (direction.includes('e')) {
                while (snappedW > constraints.minWidth && hasCollision(item, item.x, item.y, id, { w: snappedW, h: snappedH })) {
                    snappedW -= 1;
                }
            }

            if (direction.includes('s')) {
                while (snappedH > constraints.minHeight && hasCollision(item, item.x, item.y, id, { w: snappedW, h: snappedH })) {
                    snappedH -= 1;
                }
            }
        }

        snappedW = Math.max(constraints.minWidth, Math.min(snappedW, constraints.maxWidth, cols - item.x));
        snappedH = Math.max(constraints.minHeight, Math.min(snappedH, constraints.maxHeight));

        const nextPreview = {
            id,
            w: rawWidth,
            h: rawHeight,
            snappedW,
            snappedH
        };

        resizePreviewRef.current = nextPreview;

        setResizePreview(prev => {
            if (
                prev &&
                prev.id === id &&
                Math.abs(prev.w - rawWidth) < 0.01 &&
                Math.abs(prev.h - rawHeight) < 0.01
            ) {
                return prev;
            }
            return nextPreview;
        });
    }, [colWidth, marginX, rowHeight, marginY, cols, hasCollision]);

    const handleResizeEnd = useCallback((id) => {
        const resizeState = resizeStateRef.current;
        const preview = resizePreviewRef.current;

        resizeStateRef.current = null;
        setResizingId(null);

        const finalizeSession = () => {
            resizePreviewRef.current = null;
            setResizePreview(null);
            onResizeSessionEnd?.(id);
        };

        if (!preview || preview.id !== id || !resizeState) {
            finalizeSession();
            return;
        }

        const { item, constraints } = resizeState;
        const targetWidth = Math.max(constraints.minWidth, Math.min(preview.snappedW ?? Math.round(preview.w), constraints.maxWidth, cols - item.x));
        const targetHeight = Math.max(constraints.minHeight, Math.min(preview.snappedH ?? Math.round(preview.h), constraints.maxHeight));

        if (hasCollision(item, item.x, item.y, id, { w: targetWidth, h: targetHeight })) {
            finalizeSession();
            return;
        }

        if (targetWidth === item.w && targetHeight === item.h) {
            finalizeSession();
            return;
        }

        updateLayoutState(prevLayout => prevLayout.map(layoutItem =>
            layoutItem.id === id
                ? { ...layoutItem, w: targetWidth, h: targetHeight }
                : layoutItem
        ));

        finalizeSession();

        setTimeout(() => {
            onLayoutChange?.(layoutRef.current);
        }, 0);
    }, [cols, hasCollision, onLayoutChange, onResizeSessionEnd, updateLayoutState]);

    const previewHighlightPosition = useMemo(() => {
        if (dragPreview) {
            const layoutItem = layout.find(item => item.id === dragPreview.id);
            if (!layoutItem) return null;

            const clampedX = Math.max(0, Math.min((dragPreview.snappedX ?? Math.round(dragPreview.x)), cols - layoutItem.w));
            const clampedY = Math.max(0, dragPreview.snappedY ?? Math.round(dragPreview.y));

            return getItemPosition({ ...layoutItem, x: clampedX, y: clampedY });
        }

        if (resizePreview) {
            const layoutItem = layout.find(item => item.id === resizePreview.id);
            if (!layoutItem) return null;

            const width = Math.max(1, resizePreview.snappedW ?? Math.round(resizePreview.w));
            const height = Math.max(1, resizePreview.snappedH ?? Math.round(resizePreview.h));

            return getItemPosition({ ...layoutItem, w: width, h: height });
        }

        return null;
    }, [dragPreview, resizePreview, layout, cols, getItemPosition]);

    const containerHeight = useMemo(() => {
        const effectiveLayout = layout.map(item => {
            let next = item;
            if (dragPreview && dragPreview.id === item.id) {
                next = { ...next, y: dragPreview.y };
            }
            if (resizePreview && resizePreview.id === item.id) {
                next = { ...next, h: resizePreview.h };
            }
            return next;
        });

        if (effectiveLayout.length === 0) return rowHeight;

        const maxY = Math.max(...effectiveLayout.map(item => item.y + item.h));
        const normalizedMaxY = Math.ceil(maxY);
        return normalizedMaxY * rowHeight + Math.max(0, normalizedMaxY - 1) * marginY;
    }, [layout, dragPreview, resizePreview, rowHeight, marginY]);

    const shouldCaptureBackground = Boolean(isResizable && activeResizeItemId && onBackgroundPress);

    const isPointInsideActiveItem = useCallback((x, y, buffer = 0) => {
        const activeLayoutItem = layoutRef.current.find(item => item.id === activeResizeItemId);
        if (!activeLayoutItem) return false;
        const rect = getItemPosition(activeLayoutItem);
        const insideX = x >= rect.x - buffer && x <= rect.x + rect.width + buffer;
        const insideY = y >= rect.y - buffer && y <= rect.y + rect.height + buffer;
        return insideX && insideY;
    }, [activeResizeItemId, getItemPosition]);

    const shouldHandleBackgroundTouch = useCallback((evt) => {
        if (!shouldCaptureBackground) return false;
        const { locationX, locationY } = evt.nativeEvent;
        return !isPointInsideActiveItem(locationX, locationY, 24);
    }, [isPointInsideActiveItem, shouldCaptureBackground]);

    const handleBackgroundRelease = useCallback(() => {
        onBackgroundPress?.();
    }, [onBackgroundPress]);

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
