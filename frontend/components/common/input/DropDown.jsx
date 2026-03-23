import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Keyboard, Platform, InteractionManager, Touchable } from 'react-native';
import { Text, useTheme, IconButton, List, TextInput } from 'react-native-paper';
import { router } from "expo-router";
import PermissionGate from '../PermissionGate';

const ITEM_HEIGHT = 48;
const SEARCH_HEIGHT = 56;
const FOOTER_HEIGHT = 50; 

const DropDown = ({
    title,
    items = [],
    showRouterButton=true,
    onSelect,
    value,
    allowed=true,
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

    const activeSearchQuery = searchQueryValue !== undefined ? searchQueryValue : internalSearchQuery;
    
    useEffect(() => {
        if (value === undefined) {
            return;
        }

        if (value === null) {
            setSelectedItem(null);
            return;
        }

        const found = items.find((i) => i.value === value);
        setSelectedItem(found || null);
    }, [value, items]);
    
    const handleItemSelect = (item) => {
        setSelectedItem(item);
        setExpanded(false);
        if (onSelect) {
            onSelect(item.value, item);
        }

        if (clearOnSelect) {
            setSelectedItem(null);
            if (searchQueryValue === undefined) {
                setInternalSearchQuery("");
            }
        }
    }

    const handleSearchQueryChange = (query) => {
        if (searchQueryValue === undefined) {
            setInternalSearchQuery(query);
        }

        if (onSearchChange) {
            onSearchChange(query);
        }
    }

    const filteredItems = items.filter((item) =>
        (item.label ?? "").toLowerCase().includes(activeSearchQuery.toLowerCase())
    )

    const listMaxHeight = Math.min(
        ITEM_HEIGHT * maxVisibleItems,
        ITEM_HEIGHT * filteredItems.length
    );

    return (
        <List.Section>
            <List.Accordion
    title={selectedItem ? selectedItem.label : title}
    expanded={expanded}
    onPress={() => {
        if (!expanded) Keyboard.dismiss();
        setExpanded(prev => !prev)
    }}
    style={[expanded ? styles.containerExpanded : styles.containerCollapsed, { borderColor: theme.colors.outline }]}
>
    <View style={styles.searchContainer}>
        <TextInput
            mode="outlined"
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.colors.placeholderText}
            value={activeSearchQuery}
            onChangeText={handleSearchQueryChange}
            style={[styles.searchInput, { height: SEARCH_HEIGHT }]}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            theme={{ roundness: 0 }}
        />
    </View>


                <View
                    style={[ styles.panelContainer, {borderColor: theme.colors.outline,} ]}
                >

                    <ScrollView
                        nestedScrollEnabled
                        style={{ maxHeight: listMaxHeight }}
                        keyboardShouldPersistTaps="always"
                        bounces
                    >
                        {filteredItems.map((item, index) => (   
                            <TouchableOpacity onPress={() => {
                                    Keyboard.dismiss();
                                    handleItemSelect(item);
                                }}
                                key={index}
                                >
                            <List.Item
                                key={index}
                                title={item.label}
                                style={[styles.items, { borderColor: theme.colors.outline }]}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    handleItemSelect(item);
                                }}
                            />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {showRouterButton && (
                        <PermissionGate allowed={allowed}>
                            <TouchableOpacity
                                style={[styles.routerButton, { borderColor: theme.colors.outline, height: FOOTER_HEIGHT }]}
                                onPress={() => router.navigate('/modules/day-book/data-management/create-data-connection')}
                            >
                                <View style={styles.routerButtonContent}>
                                    <IconButton icon="plus" size={20} style={styles.routerIcon} iconColor={theme.colors.icon} />
                                    <Text style={[styles.routerText, { color: theme.colors.placeholderText }]}>
                                        New Data Source
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </PermissionGate>
                    )}
                </View>
            </List.Accordion>
        </List.Section>
    );
};

export default DropDown;

const styles = StyleSheet.create({
    containerCollapsed: {
        borderWidth: 1,
        borderRadius: 10
    },
    containerExpanded: {
        borderWidth: 1,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    searchContainer: {
        borderCurve: 0,
    },
    searchInput: {
        height: 50,
        fontSize: 16,
    },

    panelContainer: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        overflow: 'hidden',
    },

    items: {
        borderWidth: 1,
    },
    lastItem: {
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
    },
    routerButton: {
        height: 50,
        borderWidth: 1,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    routerButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    routerIcon: {
        margin: 0,
        marginRight: 4,
    },
    routerText: {
        fontSize: 16,
    },
});

/*
const DropDown = ({
    label = 'Select',
    options = [], //Will pull individual sources from backend
    selectedValue,
    onValueChange,
    placeholder = 'Search',
}) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const theme = useTheme();

    return (
        <View style={styles.container}>
            <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                    <TouchableOpacity onPress={() => setMenuVisible(true)}>
                        <TextInput
                            label={label}
                            value={selectedValue}
                            editable={false}
                            right={<TextInput.Icon icon="menu-down" onPress={() => setMenuVisible(true)} />}
                            style={styles.input}
                        />
                    </TouchableOpacity>
                }
                contentStyle={styles.menuContent}
            >
                <TextInput
                    placeholder={placeholder}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                    left={<TextInput.Icon icon="magnify"/>}
                    right={<TextInput.Icon icon="menu-up" onPress={() => setMenuVisible(false)} />}
                />

                <ScrollView style={styles.list}>
                    {filteredOptions.map((item, index) => (
                        <List.Item
                            key={`${item}-${index}`}
                            title={item}
                            onPress={() => {
                                onValueChange(item);
                                setMenuVisible(false);
                                setSearchQuery('');
                            }}
                            titleStyle={{ color: theme.colors.text }}
                            style={{
                                paddingVertical: 4,
                                paddingHorizontal: 10,
                            }}
                        />
                    ))}
                </ScrollView>

                <TouchableOpacity
                    style={styles.routerButton}
                    onPress={() => {
                        setMenuVisible(false);
                        setSearchQuery('');
                        router.navigate('/create-data-connection')
                    }}
                >
                    <Text style={{ color: theme.colors.placeholderText, textAlignVertical: 'center' }}>
                        New Data Source
                    </Text>
                </TouchableOpacity>
            </Menu>
        </View>
    );
};

export default DropDown;

const styles = StyleSheet.create({
    container: {
        margin: 0,
        zIndex: 999,
        width: 230,
    },
    input: {
        backgroundColor: 'white',
    },
    searchInput: {
        margin: 0,
        backgroundColor: '#f2f2f2',
    },
    menuContent: {
        paddingVertical: 0,
        width: 230,
    },
    list: {
        maxheight: 200,
    },
    routerButton: {
        borderWidth: 1,
        paddingHorizontal: 15,
        paddingVertical: 0,
        height: 50,
    },
})
*/