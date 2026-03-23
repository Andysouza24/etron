import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Alert, Dimensions, ScrollView } from 'react-native';
import { Text, IconButton, Menu, ActivityIndicator, FAB, List, Divider, useTheme, Appbar } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import Header from '../../../../../components/layout/Header';
import { GridLayout } from '../../../../../components/layout/Grid';
import CustomBottomSheet from '../../../../../components/BottomSheet';
import MetricPicker from '../../../../../components/boards/MetricPicker';
import ButtonPicker from '../../../../../components/boards/ButtonPicker';
import ResponsiveScreen from '../../../../../components/layout/ResponsiveScreen';
import { useBoardData } from '../../../../../hooks/useBoardData';
import { useMetricStates } from '../../../../../hooks/useMetricStates';
import { useDisplaySettings } from '../../../../../hooks/useDisplaySettings';
import AddItemPicker from '../../../../../components/boards/AddItemPicker';
import MetricDetailHeader from '../../../../../components/boards/MetricDetailHeader';
import MetricDetailContent from '../../../../../components/boards/MetricDetailContent';
import DisplaySettingsSheet from '../../../../../components/boards/DisplaySettingsSheet';
import TextItemEditor from '../../../../../components/boards/TextItemEditor';
import { createGridItemBuilder, createAddItemOptions } from '../../../../../components/boards/boardItemRegistry';
import { createMetricItem, createButtonItem, createTextItem, mapItemsToLayout, calculateButtonGridWidth } from '../../../../../utils/boards/itemHandlers';
import { sanitizeColourValue } from '../../../../../utils/boards/boardUtils';

const GRID_COLS = 12;
const GRID_HORIZONTAL_PADDING = 16;
const INITIAL_GRID_WIDTH = Math.max(0, Dimensions.get('window').width - GRID_HORIZONTAL_PADDING * 2);
const DEFAULT_METRIC_MAX_HEIGHT = 8;
const DEFAULT_BUTTON_MAX_HEIGHT = 3;
const DEFAULT_TEXT_ITEM_CONFIG = {
    text: '',
    alignment: 'left',
    fontSize: 18,
    padding: 16,
    textColor: '',
    backgroundColor: '',
    maxLines: undefined
};

const BoardView = ({ boardId: overrideBoardId, showHeader = true } = {}) => {
    const params = useLocalSearchParams();
    const routeBoardId = params?.id;
    const id = overrideBoardId ?? routeBoardId;
    const theme = useTheme();
    const navigationHeaderProps = overrideBoardId ? { showMenu: true } : { showBack: true };

    const { 
        board, 
        loading, 
        isEditing, 
        setIsEditing, 
        updateLayout, 
        addItem, 
        removeItem, 
        updateItem 
    } = useBoardData(id);
    
    const { metricStates, ensureMetricState } = useMetricStates(board?.items);
    const {
        displayConfigItem,
        displayConfigDraft,
        displayColourLabels,
        openDisplaySettings: openDisplaySettingsHook,
        closeDisplaySettings: closeDisplaySettingsHook,
        updateDraft,
        resetColours,
        resetAppearance
    } = useDisplaySettings(board);
    
    const [menuVisible, setMenuVisible] = useState(false);
    const [showMetricPicker, setShowMetricPicker] = useState(false);
    const [showButtonPicker, setShowButtonPicker] = useState(false);
    const [showAddItemPicker, setShowAddItemPicker] = useState(false);
    const [activeMetricItemId, setActiveMetricItemId] = useState(null);
    const [showMetricDetails, setShowMetricDetails] = useState(false);
    const [showDisplaySettings, setShowDisplaySettings] = useState(false);
    const [showEditOptions, setShowEditOptions] = useState(false);
    const [editOptionsItem, setEditOptionsItem] = useState(null);
    const [activeResizeItemId, setActiveResizeItemId] = useState(null);
    const [showTextEditor, setShowTextEditor] = useState(false);
    const [textEditorMode, setTextEditorMode] = useState('create');
    const [textEditorInitialConfig, setTextEditorInitialConfig] = useState({});
    const [textEditorTargetId, setTextEditorTargetId] = useState(null);
    const [buttonEditorMode, setButtonEditorMode] = useState('create');
    const [buttonEditorInitialConfig, setButtonEditorInitialConfig] = useState({});
    const [buttonEditorTargetId, setButtonEditorTargetId] = useState(null);
    const [gridWidth, setGridWidth] = useState(INITIAL_GRID_WIDTH);

    const editingActive = showHeader && isEditing;
    const isResizeActive = activeResizeItemId !== null;
    const styles = useMemo(() => createStyles(theme), [theme]);

    const gridItemBuilder = useMemo(() => createGridItemBuilder({
        gridCols: GRID_COLS,
        defaultMetricMaxHeight: DEFAULT_METRIC_MAX_HEIGHT,
        defaultButtonMaxHeight: DEFAULT_BUTTON_MAX_HEIGHT
    }), []);

    const handleAddMetric = useCallback(() => {
        setShowAddItemPicker(false);
        setShowMetricPicker(true);
    }, []);

    const handleAddButton = useCallback(() => {
        setShowAddItemPicker(false);
        setButtonEditorMode('create');
        setButtonEditorInitialConfig({});
        setButtonEditorTargetId(null);
        setShowButtonPicker(true);
    }, []);

    const handleAddText = useCallback(() => {
        setShowAddItemPicker(false);
        setTextEditorMode('create');
        setTextEditorInitialConfig({ ...DEFAULT_TEXT_ITEM_CONFIG });
        setTextEditorTargetId(null);
        setShowTextEditor(true);
    }, []);

    const addItemOptions = useMemo(() => createAddItemOptions(
        gridItemBuilder.definitions,
        {
            metric: handleAddMetric,
            button: handleAddButton,
            text: handleAddText
        }
    ), [gridItemBuilder, handleAddMetric, handleAddButton, handleAddText]);

    const activeMetricItem = useMemo(() => {
        if (!board?.items || !activeMetricItemId) return null;
        return board.items.find(item => item.id === activeMetricItemId) || null;
    }, [board?.items, activeMetricItemId]);

    const activeMetricState = activeMetricItem ? metricStates[activeMetricItem.id] : null;

    useEffect(() => {
        if (!editingActive) {
            setShowEditOptions(false);
            setEditOptionsItem(null);
            setShowTextEditor(false);
            setTextEditorTargetId(null);
            setShowButtonPicker(false);
            setButtonEditorMode('create');
            setButtonEditorInitialConfig({});
            setButtonEditorTargetId(null);
        }
    }, [editingActive]);

    useEffect(() => {
        if (!editingActive && activeResizeItemId !== null) {
            setActiveResizeItemId(null);
        }
    }, [editingActive, activeResizeItemId]);

    useEffect(() => {
        if (!showHeader && isEditing) {
            setIsEditing(false);
        }
    }, [showHeader, isEditing, setIsEditing]);

    useEffect(() => {
        if (!activeResizeItemId) return;
        const hasItem = board?.items?.some(item => item.id === activeResizeItemId);
        if (!hasItem) {
            setActiveResizeItemId(null);
        }
    }, [activeResizeItemId, board?.items]);

    const handleMetricSelected = useCallback(async (metric) => {
        if (!board) return;

        const existingLayout = mapItemsToLayout(board.items, GRID_COLS);
        const newItem = createMetricItem(metric, existingLayout, GRID_COLS);

        await addItem(newItem);
        setShowMetricPicker(false);
    }, [board, addItem]);

    const handleCloseButtonPicker = useCallback(() => {
        setShowButtonPicker(false);
        setButtonEditorTargetId(null);
        setButtonEditorInitialConfig({});
        setButtonEditorMode('create');
    }, []);

    const handleButtonSelected = useCallback(async (buttonConfig) => {
        if (!board) {
            handleCloseButtonPicker();
            return;
        }

        const trimmedLabel = typeof buttonConfig?.label === 'string'
            ? buttonConfig.label.trim()
            : '';

        if (buttonEditorMode === 'edit' && buttonEditorTargetId) {
            const existingItem = board.items?.find(item => item.id === buttonEditorTargetId);

            if (!existingItem) {
                handleCloseButtonPicker();
                return;
            }

            const destinationRoute = typeof buttonConfig.destination === 'string'
                ? buttonConfig.destination
                : buttonConfig.destination?.route
                    ?? existingItem.config?.destination
                    ?? null;

            const updatedLabel = trimmedLabel || existingItem.config?.label || 'Button';

            const updatedConfig = {
                ...existingItem.config,
                label: updatedLabel,
                destination: destinationRoute,
                color: buttonConfig.color ?? existingItem.config?.color,
                icon: buttonConfig.icon ?? existingItem.config?.icon,
                buttonProps: {
                    ...(existingItem.config?.buttonProps ?? {}),
                    icon: buttonConfig.icon ?? existingItem.config?.buttonProps?.icon
                }
            };

            const targetWidth = calculateButtonGridWidth(updatedLabel, GRID_COLS);
            let targetX = existingItem.x ?? 0;
            if (targetX + targetWidth > GRID_COLS) {
                targetX = Math.max(0, GRID_COLS - targetWidth);
            }

            const updates = {
                config: updatedConfig
            };

            if (existingItem.w !== targetWidth) {
                updates.w = targetWidth;
            }
            if (existingItem.x !== targetX) {
                updates.x = targetX;
            }

            await updateItem(existingItem.id, updates);
        } else {
            const existingLayout = mapItemsToLayout(board.items, GRID_COLS);
            const newItem = createButtonItem(buttonConfig, existingLayout, GRID_COLS);

            await addItem(newItem);
        }

        handleCloseButtonPicker();
    }, [board, buttonEditorMode, buttonEditorTargetId, addItem, updateItem, handleCloseButtonPicker]);

    const normalizeTextConfig = useCallback((config) => {
        return createTextItem(config, [], GRID_COLS).config;
    }, [createTextItem]);

    const handleCreateTextItem = useCallback(async (config) => {
        if (!board) return;

        const existingLayout = mapItemsToLayout(board.items, GRID_COLS);
        const newItem = createTextItem(config, existingLayout, GRID_COLS);

        await addItem(newItem);
    }, [board, addItem, mapItemsToLayout, createTextItem]);

    const handleUpdateTextItem = useCallback(async (itemId, config) => {
        if (!board || !itemId) return;

        const existingItem = board.items?.find(item => item.id === itemId);
        const normalizedConfig = normalizeTextConfig(config);

        await updateItem(itemId, {
            config: {
                ...(existingItem?.config ?? {}),
                ...normalizedConfig
            }
        });
    }, [board, normalizeTextConfig, updateItem]);

    const handleTextEditorSave = useCallback(async (config) => {
        if (textEditorMode === 'create') {
            await handleCreateTextItem(config);
        } else if (textEditorMode === 'edit' && textEditorTargetId) {
            await handleUpdateTextItem(textEditorTargetId, config);
        }

        setShowTextEditor(false);
        setTextEditorTargetId(null);
        setTextEditorInitialConfig({});
    }, [handleCreateTextItem, handleUpdateTextItem, textEditorMode, textEditorTargetId]);

    const handleRemoveItem = useCallback((itemId) => {
        Alert.alert(
            'Remove Item',
            'Are you sure you want to remove this item from the board?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Remove', 
                    style: 'destructive',
                    onPress: () => removeItem(itemId)
                }
            ]
        );
    }, [removeItem]);

    const handleOpenMetricDetails = useCallback((itemId) => {
        if (editingActive) return;
        
        setActiveMetricItemId(itemId);
        setShowMetricDetails(true);

        const item = board?.items?.find(boardItem => boardItem.id === itemId);
        if (item) {
            ensureMetricState(item, { forceRefresh: true });
        }
    }, [editingActive, board?.items, ensureMetricState]);

    const handleCloseMetricDetails = useCallback(() => {
        setShowMetricDetails(false);
        setActiveMetricItemId(null);
    }, []);

    const handleEditMetric = useCallback((metricId) => {
        if (!metricId) return;
        handleCloseMetricDetails();
        router.navigate(`/modules/day-book/metrics/edit-metric/${metricId}`);
    }, [handleCloseMetricDetails]);

    const handleOpenDisplaySettings = useCallback((item) => {
        if (!item) return;
        handleCloseMetricDetails();
        openDisplaySettingsHook(item);
        setShowDisplaySettings(true);
    }, [handleCloseMetricDetails, openDisplaySettingsHook]);

    const handleCloseDisplaySettings = useCallback(() => {
        setShowDisplaySettings(false);
        closeDisplaySettingsHook();
    }, [closeDisplaySettingsHook]);

    const handleSaveDisplaySettings = useCallback(async () => {
        if (!displayConfigItem) return;

        const colourTokens = Array.isArray(displayConfigDraft.colours)
            ? displayConfigDraft.colours.map(colour => sanitizeColourValue(colour)).filter(Boolean)
            : [];

        const appearancePayload = {};
        if (displayConfigDraft.background?.trim()) 
            appearancePayload.background = displayConfigDraft.background.trim();
        if (displayConfigDraft.axisColor?.trim()) 
            appearancePayload.axisColor = displayConfigDraft.axisColor.trim();
        if (displayConfigDraft.tickLabelColor?.trim()) 
            appearancePayload.tickLabelColor = displayConfigDraft.tickLabelColor.trim();
        if (displayConfigDraft.gridColor?.trim()) 
            appearancePayload.gridColor = displayConfigDraft.gridColor.trim();
        if (displayConfigDraft.showGrid === false) 
            appearancePayload.showGrid = false;
        const rawAngle = typeof displayConfigDraft.xAxisLabelAngle === 'number'
            ? `${displayConfigDraft.xAxisLabelAngle}`
            : displayConfigDraft.xAxisLabelAngle ?? '';
        const trimmedAngle = typeof rawAngle === 'string' ? rawAngle.trim() : '';
        if (trimmedAngle.length > 0) {
            const parsedAngle = Number(trimmedAngle);
            if (!Number.isNaN(parsedAngle)) {
                const clampedAngle = Math.max(-90, Math.min(90, parsedAngle));
                appearancePayload.xAxisLabelAngle = clampedAngle;
            }
        } else if (displayConfigItem.config?.appearance?.xAxisLabelAngle !== undefined) {
            appearancePayload.xAxisLabelAngle = null;
        }

        const updatedConfig = {
            ...displayConfigItem.config,
            label: displayConfigDraft.label?.trim() || displayConfigItem.config?.name || 'Metric'
        };

        if (colourTokens.length > 0) {
            updatedConfig.colours = colourTokens;
            updatedConfig.colors = colourTokens;
        }

        if (Object.keys(appearancePayload).length > 0) {
            updatedConfig.appearance = appearancePayload;
        }

        await updateItem(displayConfigItem.id, { config: updatedConfig });
        handleCloseDisplaySettings();
    }, [displayConfigItem, displayConfigDraft, updateItem, handleCloseDisplaySettings]);

    const handleRemoveMetricFromBoard = useCallback((itemId) => {
        handleCloseMetricDetails();
        handleRemoveItem(itemId);
    }, [handleCloseMetricDetails, handleRemoveItem]);

    const handleOpenItemOptions = useCallback((item) => {
        if (!item || isResizeActive) return;
        setEditOptionsItem(item);
        setShowEditOptions(true);
    }, [isResizeActive]);

    const handleCloseItemOptions = useCallback(() => {
        setShowEditOptions(false);
        setEditOptionsItem(null);
    }, []);

    const handleDisplaySettingsFromOptions = useCallback((item) => {
        if (!item) return;
        handleCloseItemOptions();
        handleOpenDisplaySettings(item);
    }, [handleCloseItemOptions, handleOpenDisplaySettings]);

    const handleDeleteItemFromOptions = useCallback((item) => {
        if (!item) return;
        handleCloseItemOptions();
        handleRemoveItem(item.id);
    }, [handleCloseItemOptions, handleRemoveItem]);

    const handleEditMetricFromOptions = useCallback((item) => {
        const metricId = item?.config?.metricId;
        handleCloseItemOptions();
        if (!metricId) return;
        handleEditMetric(metricId);
    }, [handleCloseItemOptions, handleEditMetric]);

    const handleEditTextFromOptions = useCallback((item) => {
        if (!item) return;
        handleCloseItemOptions();
        setTextEditorMode('edit');
        setTextEditorInitialConfig(item.config || {});
        setTextEditorTargetId(item.id);
        setShowTextEditor(true);
    }, [handleCloseItemOptions]);

    const handleEditButtonFromOptions = useCallback((item) => {
        if (!item) return;
        handleCloseItemOptions();
        setButtonEditorMode('edit');
        setButtonEditorInitialConfig({ ...(item.config || {}) });
        setButtonEditorTargetId(item.id);
        setShowButtonPicker(true);
    }, [handleCloseItemOptions]);

    const handleGridLayout = useCallback((event) => {
        const rawWidth = event?.nativeEvent?.layout?.width ?? 0;
        if (rawWidth > 0) {
            const adjustedWidth = Math.max(0, rawWidth - GRID_HORIZONTAL_PADDING * 2);
            setGridWidth(prev => (prev === adjustedWidth ? prev : adjustedWidth));
        }
    }, []);

    const handleItemLongPress = useCallback((itemId) => {
        if (!editingActive) return;
        setActiveResizeItemId(prev => {
            const nextId = prev === itemId ? null : itemId;
            if (nextId !== prev) {
                setShowEditOptions(false);
                setEditOptionsItem(null);
                setShowAddItemPicker(false);
                setShowMetricPicker(false);
                handleCloseButtonPicker();
            }
            return nextId;
        });
    }, [editingActive, handleCloseButtonPicker]);

    const handleResizeSessionEnd = useCallback((itemId) => {
        setActiveResizeItemId(prev => (prev === itemId ? null : prev));
    }, []);

    const handleExitResizeMode = useCallback(() => {
        setActiveResizeItemId(null);
        setShowEditOptions(false);
        setEditOptionsItem(null);
    }, []);

    const gridItems = useMemo(() => gridItemBuilder({
        items: board?.items,
        editingActive,
        metricStates,
        isResizeActive,
        styles,
        handlers: {
            openMetricDetails: handleOpenMetricDetails,
            openItemOptions: handleOpenItemOptions
        }
    }), [
        gridItemBuilder,
        board?.items,
        editingActive,
        metricStates,
        isResizeActive,
        handleOpenMetricDetails,
        handleOpenItemOptions,
        styles
    ]);

    if (loading) {
        return (
            <ResponsiveScreen
                header={showHeader ? <Header title="Board" {...navigationHeaderProps} titleAlignment="right" /> : undefined}
                center={true}
            >
                <ActivityIndicator size="large" />
            </ResponsiveScreen>
        );
    }

    if (!board) {
        return (
            <ResponsiveScreen
                header={showHeader ? <Header title="Board" {...navigationHeaderProps} titleAlignment="right" /> : undefined}
                center={true}
            >
                <Text>Board not found</Text>
            </ResponsiveScreen>
        );
    }

    const headerNode = showHeader ? (
        <Header
            title={board.name}
            subtitle={board.description}
            {...navigationHeaderProps}
            titleAlignment="right"
            rightActions={[
                {
                    key: 'toggle-edit',
                    icon: editingActive ? 'check' : 'pencil',
                    onPress: () => setIsEditing(!isEditing)
                },
                {
                    key: 'menu',
                    render: () => (
                        <Menu
                            visible={menuVisible}
                            onDismiss={() => setMenuVisible(false)}
                            anchor={
                                <Appbar.Action
                                    icon="dots-vertical"
                                    onPress={() => setMenuVisible(true)}
                                />
                            }
                            anchorPosition="bottom"
                        >
                            <Menu.Item
                                leadingIcon="cog"
                                title="Settings"
                                onPress={() => {
                                    setMenuVisible(false);
                                    router.navigate(`/boards/${id}/settings`);
                                }}
                            />
                        </Menu>
                    )
                }
            ]}
        />
    ) : undefined;

    return (
        <>
            <ResponsiveScreen
                header={headerNode}
                scroll={false}
                padded={false}
                center={false}
            >
                <View style={styles.container}>
                    <ScrollView
                        contentContainerStyle={board.items?.length === 0 ? styles.emptyScrollContent : styles.boardScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {board.items?.length === 0 ? (
                            <View style={styles.emptyState}>
                                <IconButton icon="view-grid-plus" size={64} />
                                <Text variant="titleLarge" style={styles.emptyTitle}>
                                    No items yet
                                </Text>
                                <Text variant="bodyMedium" style={styles.emptyDescription}>
                                    Add metrics, buttons, or text to get started
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.gridWrapper} onLayout={handleGridLayout}>
                                <GridLayout
                                    items={gridItems}
                                    cols={GRID_COLS}
                                    rowHeight={100}
                                    margin={[10, 10]}
                                    isDraggable={editingActive}
                                    isResizable={Boolean(activeResizeItemId)}
                                    activeResizeItemId={activeResizeItemId}
                                    onItemLongPress={editingActive ? handleItemLongPress : undefined}
                                    onBackgroundPress={handleExitResizeMode}
                                    onResizeSessionEnd={handleResizeSessionEnd}
                                    onLayoutChange={updateLayout}
                                    containerStyle={styles.gridContainer}
                                    containerWidth={gridWidth ?? undefined}
                                />
                            </View>
                        )}
                    </ScrollView>

                    {editingActive && !isResizeActive && (
                        <FAB
                            icon="plus"
                            style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                            color={theme.colors.onPrimary ?? '#ffffff'}
                            onPress={() => setShowAddItemPicker(true)}
                        />
                    )}
                </View>
            </ResponsiveScreen>

            {showEditOptions && editOptionsItem && (
                <CustomBottomSheet
                    variant="standard"
                    footer={{ variant: 'none' }}
                    containerStyle={{ zIndex: 9999 }}
                    header={{
                        title: editOptionsItem.type === 'metric'
                            ? 'Edit Metric'
                            : editOptionsItem.type === 'text'
                                ? 'Edit Text'
                                : 'Edit Button',
                        showClose: true
                    }}
                    onChange={(index) => {
                        if (index === -1) handleCloseItemOptions();
                    }}
                    onClose={handleCloseItemOptions}
                >
                    <View style={styles.editOptionsContainer}>
                        <Text style={styles.editOptionsItemLabel} numberOfLines={1}>
                            {editOptionsItem.config?.label
                                || editOptionsItem.config?.name
                                || (editOptionsItem.type === 'text' ? editOptionsItem.config?.text : null)
                                || 'Board Item'}
                        </Text>
                        <Divider style={styles.editOptionsDivider} />

                        {editOptionsItem.type === 'metric' && (
                            <View style={styles.editOptionsSection}>
                                <List.Item
                                    title="Edit Metric"
                                    description="Modify the underlying metric configuration"
                                    left={(props) => <List.Icon {...props} icon="pencil" />}
                                    disabled={!editOptionsItem?.config?.metricId}
                                    onPress={() => handleEditMetricFromOptions(editOptionsItem)}
                                />
                                <List.Item
                                    title="Display Settings"
                                    description="Adjust how this metric appears on the board"
                                    left={(props) => <List.Icon {...props} icon="palette" />}
                                    onPress={() => handleDisplaySettingsFromOptions(editOptionsItem)}
                                />
                                <Divider style={styles.editOptionsDivider} />
                            </View>
                        )}

                        {editOptionsItem.type === 'text' && (
                            <View style={styles.editOptionsSection}>
                                <List.Item
                                    title="Edit Text"
                                    description="Update the text content and styling"
                                    left={(props) => <List.Icon {...props} icon="pencil" />}
                                    onPress={() => handleEditTextFromOptions(editOptionsItem)}
                                />
                                <Divider style={styles.editOptionsDivider} />
                            </View>
                        )}

                        {editOptionsItem.type === 'button' && (
                            <View style={styles.editOptionsSection}>
                                <List.Item
                                    title="Edit Button"
                                    description="Update the label and destination"
                                    left={(props) => <List.Icon {...props} icon="pencil" />}
                                    onPress={() => handleEditButtonFromOptions(editOptionsItem)}
                                />
                                <Divider style={styles.editOptionsDivider} />
                            </View>
                        )}

                        <List.Item
                            title="Remove from Board"
                            description="Delete this item from the current board"
                            left={(props) => <List.Icon {...props} icon="trash-can-outline" color={theme.colors.error} />}
                            titleStyle={[styles.editOptionDeleteText, { color: theme.colors.error }]}
                            onPress={() => handleDeleteItemFromOptions(editOptionsItem)}
                        />
                    </View>
                </CustomBottomSheet>
            )}

            {showMetricDetails && activeMetricItem && (
                <CustomBottomSheet
                    variant="standard"
                    footer={{ variant: 'none' }}
                    containerStyle={{ zIndex: 9999 }}
                    header={{
                        showClose: false,
                        component: (
                            <MetricDetailHeader
                                item={activeMetricItem}
                                onEdit={handleEditMetric}
                                onDelete={handleRemoveMetricFromBoard}
                                onClose={handleCloseMetricDetails}
                                styles={styles}
                            />
                        )
                    }}
                    onChange={(index) => {
                        if (index === -1) handleCloseMetricDetails();
                    }}
                    onClose={handleCloseMetricDetails}
                >
                    <MetricDetailContent
                        item={activeMetricItem}
                        metricState={activeMetricState}
                        styles={styles}
                    />
                </CustomBottomSheet>
            )}

            <DisplaySettingsSheet
                visible={showDisplaySettings}
                item={displayConfigItem}
                draft={displayConfigDraft}
                colourLabels={displayColourLabels}
                onClose={handleCloseDisplaySettings}
                onSave={handleSaveDisplaySettings}
                onUpdateDraft={updateDraft}
                onResetColours={resetColours}
                onResetAppearance={resetAppearance}
            />

            {showMetricPicker && (
                <CustomBottomSheet
                    variant="standard"
                    footer={{ variant: 'none' }}
                    containerStyle={{ zIndex: 9999 }}
                    header={{
                        title: 'Select Metric',
                        showClose: true
                    }}
                    onChange={(index) => {
                        if (index === -1) setShowMetricPicker(false);
                    }}
                    onClose={() => setShowMetricPicker(false)}
                >
                    <MetricPicker
                        onSelect={handleMetricSelected}
                        onCancel={() => setShowMetricPicker(false)}
                        multiSelect={false}
                    />
                </CustomBottomSheet>
            )}

            {showButtonPicker && (
                <CustomBottomSheet
                    variant="standard"
                    footer={{ variant: 'none' }}
                    containerStyle={{ zIndex: 9999 }}
                    header={{
                        title: buttonEditorMode === 'edit' ? 'Edit Button' : 'Add Button',
                        showClose: true
                    }}
                    onChange={(index) => {
                        if (index === -1) handleCloseButtonPicker();
                    }}
                    onClose={handleCloseButtonPicker}
                >
                    <ButtonPicker
                        key={buttonEditorMode === 'edit' ? `edit-${buttonEditorTargetId ?? 'new'}` : 'create'}
                        mode={buttonEditorMode}
                        initialConfig={buttonEditorInitialConfig}
                        onSelect={handleButtonSelected}
                        onCancel={handleCloseButtonPicker}
                    />
                </CustomBottomSheet>
            )}

            {showTextEditor && (
                <CustomBottomSheet
                    variant="standard"
                    footer={{ variant: 'none' }}
                    containerStyle={{ zIndex: 9999 }}
                    header={{
                        title: textEditorMode === 'edit' ? 'Edit Text' : 'Add Text',
                        showClose: true
                    }}
                    onChange={(index) => {
                        if (index === -1) {
                            setShowTextEditor(false);
                            setTextEditorTargetId(null);
                            setTextEditorInitialConfig({});
                        }
                    }}
                    onClose={() => {
                        setShowTextEditor(false);
                        setTextEditorTargetId(null);
                        setTextEditorInitialConfig({});
                    }}
                >
                    <TextItemEditor
                        initialConfig={textEditorInitialConfig}
                        mode={textEditorMode}
                        onSave={handleTextEditorSave}
                        onCancel={() => {
                            setShowTextEditor(false);
                            setTextEditorTargetId(null);
                            setTextEditorInitialConfig({});
                        }}
                    />
                </CustomBottomSheet>
            )}

            {showAddItemPicker && (
                <CustomBottomSheet
                    variant="standard"
                    footer={{ variant: 'none' }}
                    containerStyle={{ zIndex: 9999 }}
                    header={{
                        title: 'Add to Board',
                        showClose: true
                    }}
                    onChange={(index) => {
                        if (index === -1) setShowAddItemPicker(false);
                    }}
                    onClose={() => setShowAddItemPicker(false)}
                >
                    <AddItemPicker
                        options={addItemOptions}
                        onSelectMetric={handleAddMetric}
                        onSelectButton={handleAddButton}
                        onSelectText={handleAddText}
                    />
                </CustomBottomSheet>
            )}
        </>
    );
};

export default BoardView;

const createStyles = (theme) => {
    const colors = theme?.colors ?? {};

    return StyleSheet.create({
        container: {
            flex: 1,
            position: 'relative'
        },
        boardScrollContent: {
            flexGrow: 1,
            paddingBottom: 120
        },
        emptyScrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: GRID_HORIZONTAL_PADDING
        },
        gridWrapper: {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: GRID_HORIZONTAL_PADDING
        },
        gridContainer: {
            flex: 1
        },
        itemContent: {
            flex: 1,
            width: '100%',
            height: '100%'
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 64
        },
        emptyTitle: {
            marginTop: 16,
            marginBottom: 8
        },
        emptyDescription: {
            opacity: 0.7,
            textAlign: 'center',
            color: colors.placeholderText ?? colors.text ?? undefined
        },
        fab: {
            position: 'absolute',
            right: 16,
            bottom: 16
        },
        editOptionsContainer: {
            paddingTop: 4,
            paddingBottom: 12
        },
        editOptionsItemLabel: {
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 4,
            color: colors.text ?? undefined
        },
        editOptionsDivider: {
            marginVertical: 4
        },
        editOptionsSection: {
            marginBottom: 4
        },
        editOptionDeleteText: {
            fontWeight: '600'
        },
        // Metric Card Styles
        metricCardTouchable: {
            flex: 1,
            width: '100%',
            height: '100%'
        },
        metricGraphCardWrapper: {
            flex: 1,
            width: '100%',
            height: '100%'
        },
        metricGraphCard: {
            flex: 1,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: colors.surface ?? colors.buttonBackground ?? '#1a1d2e',
            position: 'relative'
        },
        metricGraphCardEditing: {
            opacity: 0.7
        },
        metricEditOverlay: {
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 10
        },
        removeButton: {
            margin: 0,
            borderRadius: 16
        },
        metricPreviewChart: {
            flex: 1,
            width: '100%',
            height: '100%'
        },
        metricPreviewChartInner: {
            flex: 1,
            padding: 8
        },
        metricPreviewPlaceholder: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16
        },
        metricPreviewPlaceholderText: {
            fontSize: 12,
            textAlign: 'center',
            opacity: 0.75,
            marginTop: 8,
            color: colors.placeholderText ?? colors.text ?? undefined
        },
        metricCompactStatusErrorText: {
            color: colors.error ?? '#ff8a80'
        },
        // Button Card Styles - now handled in ButtonCard component itself
        // Metric Detail Header Styles
        metricDetailHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider ?? 'rgba(0,0,0,0.08)'
        },
        metricDetailHeaderText: {
            flex: 1,
            marginRight: 8
        },
        metricDetailHeaderTitle: {
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 2,
            color: colors.text ?? undefined
        },
        metricDetailHeaderSubtitle: {
            fontSize: 13,
            opacity: 0.65,
            color: colors.placeholderText ?? colors.text ?? undefined
        },
        metricDetailHeaderActions: {
            flexDirection: 'row',
            alignItems: 'center'
        },
        metricDetailHeaderIcon: {
            margin: 0,
            marginLeft: 4
        },
        // Metric Detail Content Styles
        metricDetailContainer: {
            flex: 1
        },
        metricDetailChart: {
            height: 280,
            marginBottom: 16,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: colors.surface ?? colors.buttonBackground ?? '#1a1d2e'
        },
        metricDetailChartInner: {
            flex: 1,
            padding: 12
        },
        metricStatus: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32
        },
        metricStatusText: {
            marginTop: 12,
            fontSize: 13,
            opacity: 0.75,
            color: colors.placeholderText ?? colors.text ?? undefined
        },
        metricErrorText: {
            fontSize: 13,
            textAlign: 'center',
            color: colors.error ?? colors.text ?? undefined
        },
        metricEmptyText: {
            fontSize: 13,
            textAlign: 'center',
            color: colors.placeholderText ?? colors.text ?? undefined
        },
        metricDetailInfo: {
            paddingHorizontal: 0
        },
        metricDetailMetaGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginBottom: 16
        },
        metricDetailMetaItem: {
            width: '50%',
            marginBottom: 12
        },
        metricDetailMetaLabel: {
            fontSize: 11,
            textTransform: 'uppercase',
            opacity: 0.5,
            marginBottom: 4,
            fontWeight: '600',
            color: colors.placeholderText ?? colors.text ?? undefined
        },
        metricDetailMetaValue: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text ?? undefined
        },
        metricDetailSummaryRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16
        },
        metricDetailSummaryChip: {
            marginBottom: 0
        },
        metricDetailVariables: {
            marginTop: 8
        },
        metricDetailChipsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 8
        },
        metricDetailChip: {
            marginBottom: 0
        }
    });
};
