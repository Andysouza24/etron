import { View, StyleSheet, ScrollView } from 'react-native';
import { Searchbar, useTheme, Chip } from 'react-native-paper';
import React, { useEffect, useState } from 'react';

const SearchBar = ({
    placeholder = "Search",
    onSearch = () => {},
    onFilterChange = () => {},
    filters,
    value,
    containerStyle,
    searchbarStyle
}) => {
    const theme = useTheme();
    const placeholderColor = theme.colors?.placeholderText ?? theme.colors?.onSurfaceVariant ?? '#9e9e9e';
    const iconColor = theme.colors?.icon ?? theme.colors?.onSurfaceVariant ?? '#616161';
    const backgroundColor = theme.colors?.background ?? '#fff';
    const borderColor = theme.colors?.outline ?? 'rgba(0,0,0,0.12)';

    const isControlled = value !== undefined;
    const [searchQuery, setSearchQuery] = useState(value ?? '');

    // create filter state if filters exist
    const [selectedFilter, setSelectedFilter] = useState(
        filters && filters.length > 0 ? filters[0] : null
    );

    useEffect(() => {
        if (!isControlled) return;
        setSearchQuery(value ?? '');
    }, [value, isControlled]);

    const handleSearch = () => {
        onSearch(searchQuery);
    };

    const handleFilterPress = (filter) => {
        setSelectedFilter(filter);
        onFilterChange(filter);
    };

    const handleChange = (text) => {
        if (!isControlled) {
            setSearchQuery(text);
        } else {
            setSearchQuery(text);
        }
        onSearch(text);
    };

    return (
        <View style={[styles.container, containerStyle]}>
            <Searchbar
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                onChangeText={handleChange}
                value={searchQuery}
                onIconPress={handleSearch}
                style={[
                    styles.searchbar,
                    {
                        backgroundColor,
                        borderColor,
                    },
                    searchbarStyle
                ]}
                inputStyle={{ fontSize: 16 }}
                iconColor={iconColor}
            />

            {filters && filters.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                >
                    {filters.map((filter) => (
                        <Chip
                            key={filter}
                            mode="flat"
                            showSelectedCheck={false}
                            selected={selectedFilter === filter}
                            onPress={() => handleFilterPress(filter)}
                            style={[
                                styles.chip,
                                {
                                    borderRadius: 14,
                                    backgroundColor: selectedFilter === filter
                                        ? theme.colors.primary
                                        : theme.colors.surfaceVariant,
                                    paddingVertical: 2
                                }
                            ]}
                            textStyle={{
                                fontSize: 12,
                                color: selectedFilter === filter ? theme.colors.onPrimary : theme.colors.text,
                                lineHeight: 12
                            }}
                        >
                            {filter}
                        </Chip>
                    ))}


                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 10,
        marginHorizontal: 20,
    },
    searchbar: {
        borderRadius: 10,
        borderWidth: 1,
    },
    chipRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        gap: 8,
        alignItems: 'center',
    },
    chip: {
        marginRight: 8,
    },
});

export default SearchBar;