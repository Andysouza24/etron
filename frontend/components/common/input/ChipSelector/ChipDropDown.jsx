import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { Chip, Menu, Portal, Surface, useTheme } from "react-native-paper";

const ITEM_HEIGHT = 48;
const MENU_CORNER_RADIUS = 4;

const ChipDropDown = ({
    title,
    items = [],
    onSelect,
    value,
    maxVisibleItems = 3.5,
    clearOnSelect = false,
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
        triggerRef.current.measureInWindow((x, y, width) => {
            setAnchor({ x, y, width });
            setExpanded(true);
        });
    };

    const closeMenu = () => setExpanded(false);

    const toggleMenu = () => (expanded ? closeMenu() : openMenu());

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
            <View ref={triggerRef} collapsable={false} style={styles.triggerWrapper}>
                <Chip
                    mode="outlined"
                    closeIcon={expanded ? "menu-up" : "menu-down"}
                    onPress={toggleMenu}
                    onClose={toggleMenu}
                    accessibilityState={{ expanded }}
                    accessibilityLabel={triggerLabel}
                >
                    {triggerLabel}
                </Chip>
            </View>

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
                    </Surface>
                </Portal>
            )}
        </>
    );
};

export default ChipDropDown;

const styles = StyleSheet.create({
    triggerWrapper: {
        alignSelf: "flex-start",
    },
    menuSurface: {
        position: "absolute",
        borderRadius: MENU_CORNER_RADIUS,
        overflow: "hidden",
    },
    menuItem: {
        height: ITEM_HEIGHT,
        justifyContent: "center",
    },
});