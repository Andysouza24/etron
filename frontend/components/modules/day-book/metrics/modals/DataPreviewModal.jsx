import React, { useState, useMemo, useCallback } from "react";
import { View, ScrollView, FlatList, StyleSheet } from "react-native";
import { Modal, Portal, Card, DataTable, Text, ActivityIndicator } from "react-native-paper";
import { dataPreviewStyles } from "../../../../../assets/styles/stylesheets/day-book/modules/metrics/dataPreview";
import { sharedModalStyles } from "../../../../../assets/styles/stylesheets/day-book/modules/metrics/sharedModalStyles";
import { formatCellValue } from "../../../../../utils/numberParser";

const ROW_LOAD_AMOUNT = 20;

export default function DataPreviewModal({ visible, onDismiss, data, variableNames, schema }) {
    const [rowLimit, setRowLimit] = useState(ROW_LOAD_AMOUNT);
    const [loadingMore, setLoadingMore] = useState(false);

    const displayedRows = useMemo(() => data.slice(0, rowLimit), [data, rowLimit]);

    const columnByName = useMemo(() => {
        const map = {};
        if (Array.isArray(schema)) {
            for (const col of schema) {
                if (col && col.name) map[col.name] = col;
            }
        }
        return map;
    }, [schema]);

    const onEndReached = useCallback(() => {
        if (loadingMore || rowLimit >= data.length) return;
        setLoadingMore(true);
        requestAnimationFrame(() => {
            setRowLimit((prev) => Math.min(prev + ROW_LOAD_AMOUNT, data.length));
            setLoadingMore(false);
        });
    }, [data.length, rowLimit, loadingMore]);

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modalContainer}>
                <Card style={[sharedModalStyles.card, dataPreviewStyles.card]}>
                    <Card.Content>
                        <ScrollView horizontal showsHorizontalScrollIndicator>
                            <View style={{ minWidth: variableNames.length * 100 }}>
                                <DataTable>
                                    <DataTable.Header>
                                        {variableNames.map((name, i) => (
                                            <DataTable.Title key={i} numberOfLines={1}>
                                                <Text>{String(name)}</Text>
                                            </DataTable.Title>
                                        ))}
                                    </DataTable.Header>
                                    <FlatList
                                        data={displayedRows}
                                        keyExtractor={(_, i) => String(i)}
                                        renderItem={({ item }) => (
                                            <DataTable.Row>
                                                {variableNames.map((name, i) => (
                                                    <DataTable.Cell key={i} style={{ width: 100 }} numberOfLines={1}>
                                                        <Text>{formatCellValue(item[name], columnByName[name])}</Text>
                                                    </DataTable.Cell>
                                                ))}
                                            </DataTable.Row>
                                        )}
                                        nestedScrollEnabled
                                        style={{ maxHeight: 180 }}
                                        initialNumToRender={5}
                                        windowSize={10}
                                        removeClippedSubviews
                                        onEndReached={onEndReached}
                                        onEndReachedThreshold={0.1}
                                        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" /> : null}
                                    />
                                </DataTable>
                            </View>
                        </ScrollView>
                    </Card.Content>
                </Card>
            </Modal>
        </Portal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        alignSelf: "center",
        width: "90%",
        maxWidth: 900,
        padding: 20,
    },
});