// Author(s): Holly Wyatt, Noah Bradley

import { useMemo } from "react";
import { View, ScrollView, FlatList, Dimensions, StyleSheet } from "react-native";
import { ActivityIndicator, Card, DataTable, Modal, Portal, Text, useTheme } from "react-native-paper";

const MAX_PREVIEW_ROWS = 15;

// Formats a cell value, prepending the currency symbol when the column is
// flagged as a displayable currency value.
const formatCell = (value, column) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (
        column?.category === "value" &&
        column?.currencySymbol &&
        column?.displayCurrencySymbol !== false
    ) {
        return `${column.currencySymbol}${str}`;
    }
    return str;
};

const DataPreviewModal = ({ visible, status, schema, rows, onDismiss }) => {
    const theme = useTheme();
    const { width, height } = Dimensions.get("window");
    const modalWidth = Math.min(width * 0.95, 900);
    const modalHeight = Math.min(height * 0.8, 520);

    const limitedRows = useMemo(() => rows.slice(0, MAX_PREVIEW_ROWS), [rows]);
    const columns = useMemo(() => schema.map((col) => col.name), [schema]);

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={{ alignSelf: "center" }}
            >
                <Card style={[styles.card, { width: modalWidth, maxHeight: modalHeight }]}>
                    <Card.Title title="Data Preview" />
                    <Card.Content>
                        {status === "loading" && (
                            <View style={[styles.center, { height: modalHeight - 120 }]}>
                                <ActivityIndicator size="large" />
                            </View>
                        )}
                        {status === "error" && (
                            <Text style={{ color: theme.colors.error }}>
                                Couldn&apos;t load data. Please try again.
                            </Text>
                        )}
                        {status === "ready" && (
                            <ScrollView horizontal showsHorizontalScrollIndicator>
                                <View
                                    style={{
                                        minWidth: columns.length * 120,
                                        maxHeight: modalHeight - 120,
                                    }}
                                >
                                    <DataTable>
                                        <DataTable.Header>
                                            {columns.map((name, i) => (
                                                <DataTable.Title key={i} numberOfLines={1}>
                                                    <Text>{name}</Text>
                                                </DataTable.Title>
                                            ))}
                                        </DataTable.Header>
                                        <FlatList
                                            data={limitedRows}
                                            keyExtractor={(_, idx) => String(idx)}
                                            renderItem={({ item }) => (
                                                <DataTable.Row>
                                                    {schema.map((col, j) => (
                                                        <DataTable.Cell
                                                            key={j}
                                                            style={{ width: 120 }}
                                                            numberOfLines={1}
                                                        >
                                                            <Text>{formatCell(item?.[col.name], col)}</Text>
                                                        </DataTable.Cell>
                                                    ))}
                                                </DataTable.Row>
                                            )}
                                            nestedScrollEnabled
                                            style={{ maxHeight: modalHeight - 160 }}
                                            initialNumToRender={MAX_PREVIEW_ROWS}
                                            windowSize={5}
                                            removeClippedSubviews
                                        />
                                    </DataTable>
                                </View>
                            </ScrollView>
                        )}
                    </Card.Content>
                </Card>
            </Modal>
        </Portal>
    );
};

export default DataPreviewModal;

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
    },
    center: {
        alignItems: "center",
        justifyContent: "center",
    },
});
