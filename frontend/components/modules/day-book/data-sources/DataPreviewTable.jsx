// Author(s): Holly Wyatt
//
// Tabular preview of a data source's stored rows. Extracted from the
// view-data-source screen so it can be reused (eg. on the revise-schema
// screen alongside the schema diff). Accepts a normalised preview payload
// shaped { data, headers?, schema? }.

import React, { useMemo, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { DataTable, Text, Button, useTheme } from "react-native-paper";
import { formatCellValue } from "../../../../utils/numberParser";

const DEFAULT_PAGE_SIZE = 10;
const EXPANDED_PAGE_SIZE = 25;
const ISO_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const DataPreviewTable = ({ preview }) => {
	const theme = useTheme();
	const [showAll, setShowAll] = useState(false);

	const allRows = Array.isArray(preview?.data) ? preview.data : [];
	const headers = useMemo(() => {
		if (Array.isArray(preview?.headers) && preview.headers.length) return preview.headers;
		const sample = allRows.slice(0, 50);
		const hasObjectRows = sample.some((r) => r && typeof r === "object" && !Array.isArray(r));
		if (!hasObjectRows) return ["value"];
		const keys = new Set();
		for (const row of sample) {
			if (row && typeof row === "object") Object.keys(row).forEach((k) => keys.add(k));
		}
		return Array.from(keys);
	}, [allRows, preview?.headers]);

	const schemaByName = useMemo(() => {
		const map = {};
		if (Array.isArray(preview?.schema)) {
			for (const col of preview.schema) {
				if (col && col.name) map[col.name] = col;
			}
		}
		return map;
	}, [preview?.schema]);

	const pageSize = showAll ? EXPANDED_PAGE_SIZE : DEFAULT_PAGE_SIZE;
	const visibleRows = allRows.slice(0, pageSize);

	const formatValue = (value, header) => {
		if (value == null) return "";
		const column = schemaByName[header];
		if (column?.currencySymbol && column.displayCurrencySymbol !== false && column.category === "value") {
			return formatCellValue(value, column);
		}
		if (typeof value === "string") {
			if (ISO_DATE_REGEX.test(value)) {
				try { return new Date(value).toLocaleString(); } catch { return value; }
			}
			return value.length > 200 ? `${value.slice(0, 200)}…` : value;
		}
		if (typeof value === "number" || typeof value === "boolean") return String(value);
		try {
			const stringified = JSON.stringify(value);
			return stringified.length > 200 ? `${stringified.slice(0, 200)}…` : stringified;
		} catch {
			return String(value);
		}
	};

	const normaliseRow = (row) => {
		if (row && typeof row === "object" && !Array.isArray(row)) return row;
		return { value: row };
	};

	return (
		<View>
			<View style={styles.summary}>
				<Text variant="labelLarge">
					Rows: {allRows.length} • Columns: {headers.length} • Showing first {pageSize}
				</Text>
				{allRows.length > DEFAULT_PAGE_SIZE ? (
					<Button mode="text" onPress={() => setShowAll((v) => !v)}>
						{showAll ? `Show ${DEFAULT_PAGE_SIZE}` : `Show ${EXPANDED_PAGE_SIZE}`}
					</Button>
				) : null}
			</View>
			<ScrollView horizontal>
				<DataTable>
					<DataTable.Header>
						{headers.map((header) => (
							<DataTable.Title key={header} style={styles.cell}>
								<Text style={styles.headerText}>{header}</Text>
							</DataTable.Title>
						))}
					</DataTable.Header>
					{visibleRows.map((row, idx) => {
						const normalised = normaliseRow(row);
						const zebra = idx % 2 === 1;
						return (
							<DataTable.Row
								key={idx}
								style={zebra ? { backgroundColor: theme.colors.surfaceVariant } : null}
							>
								{headers.map((header) => (
									<DataTable.Cell key={header} style={styles.cell}>
										<Text>{formatValue(normalised[header], header)}</Text>
									</DataTable.Cell>
								))}
							</DataTable.Row>
						);
					})}
				</DataTable>
			</ScrollView>
		</View>
	);
};

export default DataPreviewTable;

const styles = StyleSheet.create({
	summary: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
		justifyContent: "space-between",
	},
	cell: {
		width: 70,
	},
	headerText: {
		fontWeight: "700",
	},
});
