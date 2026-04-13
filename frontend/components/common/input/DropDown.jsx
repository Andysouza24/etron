import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, useTheme, Surface, Divider, Menu, Searchbar, Icon } from 'react-native-paper';
import { router } from "expo-router";
import PermissionGate from '../PermissionGate';

const ITEM_HEIGHT = 48;
const MENU_CORNER_RADIUS = 4;

const DropDown = ({
    title,
    items = [],
    showRouterButton = true,
    onSelect,
    value,
    allowed = true,
    searchPlaceholder = "Search...",
    onSearchChange,
    searchQueryValue,
    clearOnSelect = false,
    maxVisibleItems = 3.5,
}) => {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [internalSearchQuery, setInternalSearchQuery] = useState("");
    const searchBarRef = useRef(null);

    const activeSearchQuery = searchQueryValue !== undefined ? searchQueryValue : internalSearchQuery;

    useEffect(() => {
        if (value === undefined) return;
        if (value === null) { setSelectedItem(null); return; }
        const found = items.find((i) => i.value === value);
        setSelectedItem(found || null);
    }, [value, items]);

    useEffect(() => {
        if (!expanded) {
            if (searchQueryValue === undefined) setInternalSearchQuery("");
            if (onSearchChange) onSearchChange("");
        }
    }, [expanded]);

    const handleItemSelect = (item) => {
        setSelectedItem(item);
        setExpanded(false);
        if (onSelect) onSelect(item.value, item);
        if (clearOnSelect) {
            setSelectedItem(null);
            if (searchQueryValue === undefined) setInternalSearchQuery("");
        }
    };

    const handleSearchQueryChange = (query) => {
        if (searchQueryValue === undefined) setInternalSearchQuery(query);
        if (onSearchChange) onSearchChange(query);
    };

    const filteredItems = items.filter((item) =>
        (item.label ?? "").toLowerCase().includes(activeSearchQuery.toLowerCase())
    );

    const listMaxHeight = Math.min(
        ITEM_HEIGHT * maxVisibleItems,
        ITEM_HEIGHT * filteredItems.length
    );

    const triggerLabel = selectedItem ? selectedItem.label : title;
    const isTitlePlaceholder = !selectedItem;

    const handleClearSearch = () => {
        handleSearchQueryChange("");
    };

    return (
        <View style={{ zIndex: expanded ? 9999 : 0 }}>
            {/* Backdrop to close on outside tap */}
            {expanded && (
                <Pressable
                    style={styles.backdrop}
                    onPress={() => setExpanded(false)}
                />
            )}

            {/* Trigger / inline search */}
            {expanded ? (
                <Searchbar
                    ref={searchBarRef}
                    placeholder={searchPlaceholder}
                    value={activeSearchQuery}
                    onChangeText={handleSearchQueryChange}
                    onClearIconPress={handleClearSearch}
                    traileringIcon="menu-up"
                    onTraileringIconPress={() => setExpanded(false)}
                    style={[
                        styles.searchBar,
                        {
                            borderColor: theme.colors.outline,
                            backgroundColor: theme.colors.surface,
                        },
                    ]}
                    inputStyle={styles.searchBarInput}
                    elevation={0}
                />
            ) : (
                <Pressable
                    onPress={() => {
                        setExpanded(true);
                    }}
                    style={({ pressed }) => [
                        styles.trigger,
                        styles.triggerCollapsed,
                        {
                            borderColor: theme.colors.outline,
                            backgroundColor: pressed
                                ? theme.colors.surfaceVariant
                                : theme.colors.surface,
                        },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: false }}
                    accessibilityLabel={triggerLabel}
                >
                    <Text
                        style={[
                            styles.triggerText,
                            { color: isTitlePlaceholder ? theme.colors.onSurfaceVariant : theme.colors.onSurface },
                        ]}
                        numberOfLines={1}
                    >
                        {triggerLabel}
                    </Text>
                    <Icon
                        source="menu-down"
                        size={24}
                        color={theme.colors.onSurfaceVariant}
                    />
                </Pressable>
            )}

            {/* Expanded menu panel */}
            {expanded && (
                <Surface
                    style={styles.menuSurface}
                    elevation={2}
                >
                    <Divider />

                    {/* Menu items */}
                    <ScrollView
                        style={{ maxHeight: listMaxHeight }}
                        keyboardShouldPersistTaps="always"
                        nestedScrollEnabled={true}
                        scrollEnabled={true}
                    >
                        {filteredItems.map((item, index) => (
                            <Menu.Item
                                key={index}
                                title={item.label}
                                onPress={() => handleItemSelect(item)}
                                style={
                                    selectedItem?.value === item.value
                                        ? { backgroundColor: theme.colors.secondaryContainer }
                                        : undefined
                                }
                                titleStyle={
                                    selectedItem?.value === item.value
                                        ? { color: theme.colors.onSecondaryContainer }
                                        : undefined
                                }
                            />
                        ))}
                    </ScrollView>

                    {/* Footer: New Data Source */}
                    {showRouterButton && (
                        <PermissionGate allowed={allowed}>
                            <View>
                                <Divider />
                                <Menu.Item
                                    leadingIcon="plus"
                                    title="New Data Source"
                                    onPress={() =>
                                        router.navigate('/modules/day-book/data-management/create-data-connection')
                                    }
                                    titleStyle={{ color: theme.colors.onSurfaceVariant }}
                                />
                            </View>
                        </PermissionGate>
                    )}
                </Surface>
            )}
        </View>
    );
};

export default DropDown;

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        height: ITEM_HEIGHT,
        paddingHorizontal: 12,
    },
    triggerCollapsed: {
        borderRadius: MENU_CORNER_RADIUS,
    },
    triggerText: {
        flex: 1,
        fontSize: 16,
        marginRight: 8,
    },
    backdrop: {
        position: 'absolute',
        top: -9999,
        bottom: -9999,
        left: -9999,
        right: -9999,
        zIndex: 1,
    },
    searchBar: {
        borderWidth: 1,
        borderRadius: 0,
        borderTopLeftRadius: MENU_CORNER_RADIUS,
        borderTopRightRadius: MENU_CORNER_RADIUS,
        height: ITEM_HEIGHT,
        zIndex: 2,
    },
    searchBarInput: {
        fontSize: 14,
    },
    menuSurface: {
        position: 'absolute',
        top: ITEM_HEIGHT,
        left: 0,
        right: 0,
        zIndex: 9999,
        borderBottomLeftRadius: MENU_CORNER_RADIUS,
        borderBottomRightRadius: MENU_CORNER_RADIUS,
    },
});