import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Searchbar, ActivityIndicator, useTheme } from 'react-native-paper';

/**
 * Reusable searchable, scrollable, height-capped list.
 *
 * Props:
 *   items        - array of data items
 *   getKey       - (item) => string  — unique key per item
 *   filterItem   - (item, lowerQuery) => bool  — defaults to getLabel + getSubtitle match
 *   getLabel     - (item) => string  — primary text, used by default filter
 *   getSubtitle  - (item) => string | null  — used by default filter
 *   renderItem   - (item) => React.Node  — full row content (caller controls layout)
 *   maxHeight    - number (default 280)
 *   emptyText    - string
 *   loading      - bool
 *   searchPlaceholder - string
 *   style        - ViewStyle
 */
const SearchableList = ({
    items = [],
    getKey,
    filterItem,
    getLabel,
    getSubtitle,
    renderItem,
    maxHeight = 280,
    emptyText = 'No items found.',
    loading = false,
    searchPlaceholder = 'Search...',
    style,
}) => {
    const theme = useTheme();
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) => {
            if (filterItem) return filterItem(item, q);
            const label = getLabel ? String(getLabel(item) ?? '').toLowerCase() : '';
            const sub = getSubtitle ? String(getSubtitle(item) ?? '').toLowerCase() : '';
            return label.includes(q) || sub.includes(q);
        });
    }, [items, query, filterItem, getLabel, getSubtitle]);

    return (
        <View style={style}>
            <Searchbar
                placeholder={searchPlaceholder}
                value={query}
                onChangeText={setQuery}
                style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
                inputStyle={styles.searchInput}
                elevation={0}
            />
            <ScrollView
                style={[
                    styles.list,
                    { maxHeight, borderColor: theme.colors.outlineVariant ?? theme.colors.outline },
                ]}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
            >
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="small" />
                    </View>
                ) : filtered.length === 0 ? (
                    <Text
                        variant="bodySmall"
                        style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}
                    >
                        {query ? `No results for "${query}"` : emptyText}
                    </Text>
                ) : (
                    filtered.map((item) => (
                        <View
                            key={getKey(item)}
                            style={[styles.itemWrapper, { borderBottomColor: theme.colors.outlineVariant ?? theme.colors.outline }]}
                        >
                            {renderItem(item)}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    searchbar: {
        borderRadius: 8,
        marginBottom: 6,
        height: 42,
    },
    searchInput: {
        fontSize: 14,
        minHeight: 0,
    },
    list: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
    },
    center: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    empty: {
        padding: 16,
        textAlign: 'center',
    },
    itemWrapper: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});

export default SearchableList;
