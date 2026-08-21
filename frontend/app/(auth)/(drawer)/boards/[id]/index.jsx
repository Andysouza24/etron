import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Alert, Dimensions, ScrollView } from 'react-native';
import { Text, IconButton, Menu, ActivityIndicator, FAB, List, Divider, useTheme, Appbar } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useDrawerStatus } from '@react-navigation/drawer';
import Header from '../../../../../components/layout/Header';
import { GridLayout } from '../../../../../components/layout/Grid';
import CustomBottomSheet from '../../../../../components/BottomSheet';
import MetricPicker from '../../../../../components/boards/MetricPicker';
import ButtonPicker from '../../../../../components/boards/ButtonPicker';
import ResponsiveScreen from '../../../../../components/layout/ResponsiveScreen';
import { useBoardData } from '../../../../../hooks/boards/useBoardData';
import { useMetricStates } from '../../../../../hooks/useMetricStates';
import { useDisplaySettings } from '../../../../../hooks/useDisplaySettings';
import AddItemPicker from '../../../../../components/boards/AddItemPicker';
import MetricDetailHeader from '../../../../../components/boards/MetricDetailHeader';
import MetricDetailContent from '../../../../../components/boards/MetricDetailContent';
import DisplaySettingsSheet from '../../../../../components/boards/DisplaySettingsSheet';
import TextItemEditor from '../../../../../components/boards/TextItemEditor';
import { createGridItemBuilder, createAddItemOptions } from '../../../../../components/boards/boardItemRegistry';
import { sanitizeColourValue } from '../../../../../utils/boards/boardUtils';
import { useHasPermission } from '../../../../../hooks/useHasPermission';
import { useMetricContext } from '../../../../../contexts/MetricContext';
import { useDataSourceContext } from '../../../../../contexts/DataSourceContext';
import useButtonItemEditor from '../../../../../hooks/boards/useButtonItemEditor';
import useTextItemEditor from '../../../../../hooks/boards/useTextItemEditor';
import useMetricPickerState from '../../../../../hooks/boards/useMetricPickerState';
import useMetricDetailSheet from '../../../../../hooks/boards/useMetricDetailSheet';
import useBoardEditMode from '../../../../../hooks/boards/useBoardEditMode';

const MANAGE_BOARDS_PERM = "app.workspace.manage_boards";
const MANAGE_METRICS_PERM = "modules.daybook.metrics.manage_metrics";

const GRID_COLS = 12;
const GRID_HORIZONTAL_PADDING = 16;
const INITIAL_GRID_WIDTH = Math.max(0, Dimensions.get('window').width - GRID_HORIZONTAL_PADDING * 2);
const DEFAULT_METRIC_MAX_HEIGHT = 8;
const DEFAULT_BUTTON_MAX_HEIGHT = 3;

const BoardView = ({ boardId: overrideBoardId, showHeader = true } = {}) => {
    const params = useLocalSearchParams();
    const routeBoardId = params?.id;
    const id = overrideBoardId ?? routeBoardId;
    const theme = useTheme();
    const { allowed: canManageBoards } = useHasPermission(MANAGE_BOARDS_PERM);
    const { allowed: canManageMetrics } = useHasPermission(MANAGE_METRICS_PERM);
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
    
    const { metricStates, ensureMetricState, setMetricYear } = useMetricStates(board?.items);
    const { metrics: workspaceMetrics, ensureMetrics } = useMetricContext();
    const { dataSources, refreshDataSources } = useDataSourceContext();

    useEffect(() => {
        ensureMetrics?.();
    }, [ensureMetrics]);

    useEffect(() => {
        refreshDataSources?.();
    }, [refreshDataSources]);

    // Lookup of data sources keyed by dataSourceId. Used to flag metrics
    // whose underlying data source is currently in an error state so the
    // user can be warned that the data may not be up to date.
    const dataSourceById = useMemo(() => {
        const map = {};
        for (const ds of dataSources?.list || []) {
            if (ds?.dataSourceId) map[ds.dataSourceId] = ds;
        }
        return map;
    }, [dataSources]);

    // Lookup of source-metric appearance keyed by metricId. Board metric
    // cards inherit their appearance from this and apply per-board overrides
    // on top via mergeAppearance().
    const metricAppearancesById = useMemo(() => {
        const map = {};
        (workspaceMetrics || []).forEach((metric) => {
            if (metric?.metricId) {
                map[metric.metricId] = metric.config?.appearance || metric.appearance || {};
            }
        });
        return map;
    }, [workspaceMetrics]);

    // Lookup of full metric records keyed by metricId. Used to detect when
    // a board item references a metric that no longer exists (or whose
    // data source has been deleted) so a placeholder can be rendered.
    // Returns null until the workspace metric list has loaded so that
    // loading state isn't mistaken for deletion.
    const metricsById = useMemo(() => {
        if (!Array.isArray(workspaceMetrics)) return null;
        const map = {};
        workspaceMetrics.forEach((metric) => {
            if (metric?.metricId) {
                map[metric.metricId] = metric;
            }
        });
        return map;
    }, [workspaceMetrics]);

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
    
    const [showAddItemPicker, setShowAddItemPicker] = useState(false);
    const [showDisplaySettings, setShowDisplaySettings] = useState(false);

    const editingActive = showHeader && isEditing;
    const styles = useMemo(() => createStyles(theme), [theme]);

    const {
        showButtonPicker,
        buttonEditorMode,
        buttonEditorInitialConfig,
        buttonEditorTargetId,
        openCreate: openButtonEditorCreate,
        openEdit: openButtonEditorEdit,
        close: handleCloseButtonPicker,
        handleSelected: handleButtonSelected,
    } = useButtonItemEditor({ board, addItem, updateItem, editingActive, gridCols: GRID_COLS });

    const {
        showTextEditor,
        textEditorMode,
        textEditorInitialConfig,
        openCreate: openTextEditorCreate,
        openEdit: openTextEditorEdit,
        close: closeTextEditor,
        handleSave: handleTextEditorSave,
    } = useTextItemEditor({ board, addItem, updateItem, editingActive, gridCols: GRID_COLS });

    const {
        showMetricPicker,
        open: openMetricPicker,
        close: closeMetricPicker,
        handleMetricSelected,
    } = useMetricPickerState({ board, addItem, gridCols: GRID_COLS });

    const {
        showMetricDetails,
        activeMetricItem,
        open: handleOpenMetricDetails,
        close: handleCloseMetricDetails,
    } = useMetricDetailSheet({ board, editingActive, ensureMetricState });

    const activeMetricState = activeMetricItem ? metricStates[activeMetricItem.id] : null;

    const {
        menuVisible,
        setMenuVisible,
        activeResizeItemId,
        isResizeActive,
        gridWidth,
        showEditOptions,
        editOptionsItem,
        handleGridLayout,
        handleItemLongPress,
        handleExitResizeMode,
        handleOpenItemOptions,
        handleCloseItemOptions,
    } = useBoardEditMode({
        editingActive,
        boardItems: board?.items,
        initialGridWidth: INITIAL_GRID_WIDTH,
        gridHorizontalPadding: GRID_HORIZONTAL_PADDING,
        onCloseButtonPicker: handleCloseButtonPicker,
        onCloseMetricPicker: closeMetricPicker,
        onCloseAddItemPicker: () => setShowAddItemPicker(false),
    });

    const gridItemBuilder = useMemo(() => createGridItemBuilder({
        gridCols: GRID_COLS,
        defaultMetricMaxHeight: DEFAULT_METRIC_MAX_HEIGHT,
        defaultButtonMaxHeight: DEFAULT_BUTTON_MAX_HEIGHT
    }), []);

    const handleAddMetric = useCallback(() => {
        setShowAddItemPicker(false);
        openMetricPicker();
    }, [openMetricPicker]);

    const handleAddButton = useCallback(() => {
        setShowAddItemPicker(false);
        openButtonEditorCreate();
    }, [openButtonEditorCreate]);

    const handleAddText = useCallback(() => {
        setShowAddItemPicker(false);
        openTextEditorCreate();
    }, [openTextEditorCreate]);

    const addItemOptions = useMemo(() => createAddItemOptions(
        gridItemBuilder.definitions,
        {
            metric: handleAddMetric,
            button: handleAddButton,
            text: handleAddText
        }
    ), [gridItemBuilder, handleAddMetric, handleAddButton, handleAddText]);

    useEffect(() => {
        if (!showHeader && isEditing) {
            setIsEditing(false);
        }
    }, [showHeader, isEditing, setIsEditing]);

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

    const handleEditMetric = useCallback((metricId) => {
        if (!metricId) return;
        handleCloseMetricDetails();
        router.navigate(`/modules/day-book/metrics/edit-metric/${metricId}`);
    }, [handleCloseMetricDetails]);

    const handleOpenDisplaySettings = useCallback((item) => {
        if (!item) return;
        handleCloseMetricDetails();
        const metricAppearance = metricAppearancesById[item.config?.metricId];
        openDisplaySettingsHook(item, metricAppearance);
        setShowDisplaySettings(true);
    }, [handleCloseMetricDetails, openDisplaySettingsHook, metricAppearancesById]);

    const handleCloseDisplaySettings = useCallback(() => {
        setShowDisplaySettings(false);
        closeDisplaySettingsHook();
    }, [closeDisplaySettingsHook]);

    // Close transient overlays (metric details, display settings) whenever
    // the navigation drawer opens so the sheet doesn't sit underneath it.
    const drawerStatus = useDrawerStatus();
    useEffect(() => {
        if (drawerStatus !== 'open') return;
        if (showMetricDetails) handleCloseMetricDetails();
        if (showDisplaySettings) handleCloseDisplaySettings();
    }, [drawerStatus, showMetricDetails, showDisplaySettings, handleCloseMetricDetails, handleCloseDisplaySettings]);

    const handleSaveDisplaySettings = useCallback(async () => {
        if (!displayConfigItem) return;

        const colourTokens = Array.isArray(displayConfigDraft.colours)
            ? displayConfigDraft.colours.map(colour => sanitizeColourValue(colour)).filter(Boolean)
            : [];

        const metricAppearance = metricAppearancesById[displayConfigItem.config?.metricId] || {};

        // Build sparse override map: only keep entries the user actually
        // changed away from the inherited metric appearance. Empty/blank
        // entries always fall back to inherited.
        const setOverrideIfDifferent = (overrides, key, draftValue, inheritedValue) => {
            if (draftValue === undefined || draftValue === null) return;
            if (typeof draftValue === 'string' && draftValue.trim() === '') return;
            const normalized = typeof draftValue === 'string' ? draftValue.trim() : draftValue;
            if (normalized === inheritedValue) return;
            overrides[key] = normalized;
        };

        const overrides = {};
        setOverrideIfDifferent(overrides, 'background', displayConfigDraft.background, metricAppearance.background);
        setOverrideIfDifferent(overrides, 'axisColor', displayConfigDraft.axisColor, metricAppearance.axisColor);
        setOverrideIfDifferent(overrides, 'tickLabelColor', displayConfigDraft.tickLabelColor, metricAppearance.tickLabelColor);
        setOverrideIfDifferent(overrides, 'gridColor', displayConfigDraft.gridColor, metricAppearance.gridColor);

        const inheritedShowGrid = metricAppearance.showGrid !== undefined ? metricAppearance.showGrid : true;
        if (displayConfigDraft.showGrid !== inheritedShowGrid) {
            overrides.showGrid = displayConfigDraft.showGrid;
        }

        const rawAngle = typeof displayConfigDraft.xAxisLabelAngle === 'number'
            ? `${displayConfigDraft.xAxisLabelAngle}`
            : displayConfigDraft.xAxisLabelAngle ?? '';
        const trimmedAngle = typeof rawAngle === 'string' ? rawAngle.trim() : '';
        if (trimmedAngle.length > 0) {
            const parsedAngle = Number(trimmedAngle);
            if (!Number.isNaN(parsedAngle)) {
                const clampedAngle = Math.max(-90, Math.min(90, parsedAngle));
                if (clampedAngle !== metricAppearance.xAxisLabelAngle) {
                    overrides.xAxisLabelAngle = clampedAngle;
                }
            }
        }

        const updatedConfig = {
            ...displayConfigItem.config,
            label: displayConfigDraft.label?.trim() || displayConfigItem.config?.name || 'Metric',
            // Replace board appearance entirely — only keep the user's
            // overrides. Cleared fields fall back to the metric's appearance
            // automatically at render time via mergeAppearance().
            appearance: overrides,
        };

        if (colourTokens.length > 0) {
            updatedConfig.colours = colourTokens;
            updatedConfig.colors = colourTokens;
        }

        await updateItem(displayConfigItem.id, { config: updatedConfig });
        handleCloseDisplaySettings();
    }, [displayConfigItem, displayConfigDraft, metricAppearancesById, updateItem, handleCloseDisplaySettings]);

    const handleRemoveMetricFromBoard = useCallback((itemId) => {
        handleCloseMetricDetails();
        handleRemoveItem(itemId);
    }, [handleCloseMetricDetails, handleRemoveItem]);

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
        openTextEditorEdit(item);
    }, [handleCloseItemOptions, openTextEditorEdit]);

    const handleEditButtonFromOptions = useCallback((item) => {
        if (!item) return;
        handleCloseItemOptions();
        openButtonEditorEdit(item);
    }, [handleCloseItemOptions, openButtonEditorEdit]);

    const gridItems = useMemo(() => gridItemBuilder({
        items: board?.items,
        editingActive,
        metricStates,
        metricAppearancesById,
        metricsById,
        dataSourceById,
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
        metricAppearancesById,
        metricsById,
        dataSourceById,
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
                ...(canManageBoards ? [{
                    key: 'toggle-edit',
                    icon: editingActive ? 'check' : 'pencil',
                    onPress: () => setIsEditing(!isEditing)
                }] : []),
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
                            {canManageBoards && (
                                <Menu.Item
                                    leadingIcon="cog"
                                    title="Settings"
                                    onPress={() => {
                                        setMenuVisible(false);
                                        router.navigate(`/boards/${id}/settings`);
                                    }}
                                />
                            )}
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
                            style={[styles.fab/*, { backgroundColor: theme.colors.metricsBlue }*/]}
                            /*color={theme.colors.primary ?? '#ffffff'}*/
                            onPress={() => setShowAddItemPicker(true)}
                            variant="surface"
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
                                {canManageMetrics && (
                                    <List.Item
                                        title="Edit Metric"
                                        description="Modify the underlying metric configuration"
                                        left={(props) => <List.Icon {...props} icon="pencil" />}
                                        disabled={!editOptionsItem?.config?.metricId}
                                        onPress={() => handleEditMetricFromOptions(editOptionsItem)}
                                    />
                                )}
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
                        metricAppearance={metricAppearancesById[activeMetricItem.config?.metricId]}
                        onYearChange={(year) => setMetricYear(activeMetricItem.id, year)}
                        styles={styles}
                        dataSourceErrored={
                            dataSourceById?.[activeMetricItem.config?.dataSourceId]?.status === 'error'
                        }
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
                        if (index === -1) closeMetricPicker();
                    }}
                    onClose={() => closeMetricPicker()}
                >
                    <MetricPicker
                        onSelect={handleMetricSelected}
                        onCancel={() => closeMetricPicker()}
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
                            closeTextEditor();
                        }
                    }}
                    onClose={closeTextEditor}
                >
                    <TextItemEditor
                        initialConfig={textEditorInitialConfig}
                        mode={textEditorMode}
                        onSave={handleTextEditorSave}
                        onCancel={closeTextEditor}
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
            paddingVertical: 8
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
            // Match the view-metric screen: a square chart area that
            // grows with screen width rather than a fixed short height.
            // Constrain height for bottom sheet display to ensure bottom axis
            // and labels remain visible on small screens.
            aspectRatio: 1,
            maxHeight: 320,
            marginBottom: 16,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: colors.surface ?? colors.buttonBackground ?? '#1a1d2e'
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