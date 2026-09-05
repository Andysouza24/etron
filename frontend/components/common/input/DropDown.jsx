import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text, useTheme, Portal, Surface, Divider, Menu, Icon } from 'react-native-paper';
import { router } from "expo-router";
import PermissionGate from '../PermissionGate';

const ITEM_HEIGHT = 48;
const MENU_CORNER_RADIUS = 4;
const MENU_VERTICAL_GAP = 4;

const DropDown = ({
    title,
    items = [],
    showRouterButton = true,
    onSelect,
    value,
    allowed = true,
    clearOnSelect = false,
    maxVisibleItems = 3.5,
    noStyle = false,
}) => {
    const theme = useTheme();
    const triggerRef = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0 });

    useEffect(() => {
        if (value === undefined) return;
        if (value === null) { setSelectedItem(null); return; }
        const found = items.find((i) => i.value === value);
        setSelectedItem(found || null);
    }, [value, items]);

    const openMenu = () => {
        if (!triggerRef.current) {
            setExpanded(true);
            return;
        }
        triggerRef.current.measureInWindow((x, y, width, height) => {
            setAnchor({ x, y: y + height + MENU_VERTICAL_GAP, width });
            setExpanded(true);
        });
    };

    const closeMenu = () => setExpanded(false);

    const handleItemSelect = (item) => {
        closeMenu();
        if (onSelect) onSelect(item.value, item);
        if (clearOnSelect) {
            setSelectedItem(null);
        } else {
            setSelectedItem(item);
        }
    };

    const listHeight = Math.min(
        ITEM_HEIGHT * maxVisibleItems,
        ITEM_HEIGHT * items.length
    );

    const triggerLabel = selectedItem ? selectedItem.label : title;
    const isTitlePlaceholder = !selectedItem;

    const menuContainerColor =
        theme.colors.surfaceContainer ??
        theme.colors.elevation?.level2 ??
        theme.colors.surface;

    const renderItem = ({ item }) => {
        const isSelected = selectedItem?.value === item.value;
        return (
            <Menu.Item
                title={item.label}
                onPress={() => handleItemSelect(item)}
                style={[
                    styles.menuItem,
                    isSelected && { backgroundColor: theme.colors.secondaryContainer },
                ]}
                titleStyle={{
                    color: isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurface,
                }}
            />
        );
    };

    return (
        <>
            <Pressable
                ref={triggerRef}
                onPress={() => (expanded ? closeMenu() : openMenu())}
                style={({ pressed }) => [
                    styles.trigger,
                    {
                        borderColor: expanded ? theme.colors.primary : theme.colors.outline,
                        borderWidth: expanded ? 2 : 1,
                        backgroundColor: noStyle
                            ? "transparent"
                            : pressed
                                ? theme.colors.surfaceVariant
                                : theme.colors.surface,
                    },
                ]}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
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
                    source={expanded ? "menu-up" : "menu-down"}
                    size={24}
                    color={theme.colors.onSurfaceVariant}
                />
            </Pressable>

            {expanded && (
                <Portal>
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
                    <Surface
                        elevation={2}
                        style={[
                            styles.menuSurface,
                            {
                                top: anchor.y,
                                left: anchor.x,
                                width: anchor.width,
                                backgroundColor: menuContainerColor,
                            },
                        ]}
                    >
                        <View style={{ height: listHeight }}>
                            <FlatList
                                data={items}
                                keyExtractor={(item, idx) => `${item.value ?? idx}`}
                                renderItem={renderItem}
                                keyboardShouldPersistTaps="always"
                                showsVerticalScrollIndicator
                                getItemLayout={(_, index) => ({
                                    length: ITEM_HEIGHT,
                                    offset: ITEM_HEIGHT * index,
                                    index,
                                })}
                            />
                        </View>

                        {showRouterButton && (
                            <PermissionGate allowed={allowed}>
                                <View>
                                    <Divider />
                                    <Menu.Item
                                        leadingIcon="plus"
                                        title="New Data Source"
                                        onPress={() => {
                                            closeMenu();
                                            router.navigate('/modules/day-book/data-management/create-data-connection');
                                        }}
                                        titleStyle={{ color: theme.colors.onSurfaceVariant }}
                                    />
                                </View>
                            </PermissionGate>
                        )}
                    </Surface>
                </Portal>
            )}
        </>
    );
};

export default DropDown;

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: MENU_CORNER_RADIUS,
        height: ITEM_HEIGHT,
        paddingHorizontal: 12,
    },
    triggerText: {
        flex: 1,
        fontSize: 16,
        marginRight: 8,
    },
    menuSurface: {
        position: 'absolute',
        borderRadius: MENU_CORNER_RADIUS,
        overflow: 'hidden',
    },
    menuItem: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
    },
});
