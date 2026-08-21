// Author(s): Holly Wyatt
//
// Per-column row used inside the "revise schema" screen. Renders the column's
// name, its current/suggested type as a chip, an inline "new" badge when the
// column appeared only in the failing data, and (when editable) a category
// + type picker so the user can fine-tune brand-new fields before reapplying
// the schema.

import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, Chip, useTheme, Menu, Divider } from "react-native-paper";

const CATEGORIES = [
	{ key: "dimension", label: "Dimension" },
	{ key: "value", label: "Value" },
	{ key: "date", label: "Date" },
];

const VALUE_TYPES = [
	{ label: "Integer", value: "bigint" },
	{ label: "Decimal", value: "double" },
	{ label: "Currency", value: "decimal(18,2)" },
];

// describes the displayable type label for a column
function describeType(column) {
	if (!column) return "";
	if (column.category === "value") {
		const match = VALUE_TYPES.find((t) => t.value === column.type);
		return match ? match.label : column.type;
	}
	if (column.category === "date") return "Date / time";
	return "Dimension";
}

const SchemaFieldRow = ({ column, editable = false, onChange }) => {
	const theme = useTheme();
	const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
	const [typeMenuVisible, setTypeMenuVisible] = useState(false);

	const isNew = !!column.isNew;
	const category = column.category || "dimension";

	const handleCategoryChange = (next) => {
		setCategoryMenuVisible(false);
		if (next === category) return;
		// when category flips, pick a sensible default type. Value columns
		// default to "double" (the previous suggestion is preserved when
		// available), date columns become "timestamp", dimensions become "string".
		let nextType = column.type;
		if (next === "value") nextType = column.suggestedType || "double";
		else if (next === "date") nextType = "timestamp";
		else if (next === "dimension") nextType = "string";
		onChange?.({ ...column, category: next, type: nextType });
	};

	const handleTypeChange = (nextType) => {
		setTypeMenuVisible(false);
		if (nextType === column.type) return;
		onChange?.({ ...column, type: nextType });
	};

	return (
		<View style={styles.row} accessibilityLabel={`Field ${column.name}`}>
			<View style={styles.headerRow}>
				<Text variant="bodyLarge" style={styles.name} numberOfLines={1}>
					{column.name}
				</Text>
				{isNew ? (
					<Chip
						compact
						icon="star-four-points"
						style={[styles.newChip, { backgroundColor: theme.colors.tertiaryContainer }]}
						textStyle={{ color: theme.colors.onTertiaryContainer }}
					>
						New
					</Chip>
				) : null}
			</View>

			<View style={styles.controls}>
				{editable ? (
					<>
						<Menu
							visible={categoryMenuVisible}
							onDismiss={() => setCategoryMenuVisible(false)}
							anchor={
								<Pressable onPress={() => setCategoryMenuVisible(true)}>
									<Chip
										compact
										icon="format-list-bulleted"
										style={styles.chip}
									>
										{CATEGORIES.find((c) => c.key === category)?.label || "Dimension"}
									</Chip>
								</Pressable>
							}
						>
							{CATEGORIES.map((c) => (
								<Menu.Item
									key={c.key}
									title={c.label}
									onPress={() => handleCategoryChange(c.key)}
								/>
							))}
						</Menu>
						{category === "value" ? (
							<Menu
								visible={typeMenuVisible}
								onDismiss={() => setTypeMenuVisible(false)}
								anchor={
									<Pressable onPress={() => setTypeMenuVisible(true)}>
										<Chip compact icon="numeric" style={styles.chip}>
											{describeType(column)}
										</Chip>
									</Pressable>
								}
							>
								{VALUE_TYPES.map((t) => (
									<Menu.Item
										key={t.value}
										title={t.label}
										onPress={() => handleTypeChange(t.value)}
									/>
								))}
							</Menu>
						) : (
							<Chip compact style={styles.chip}>
								{describeType(column)}
							</Chip>
						)}
					</>
				) : (
					<Chip compact style={styles.chip}>
						{describeType(column)}
					</Chip>
				)}
			</View>
			<Divider style={styles.divider} />
		</View>
	);
};

export default SchemaFieldRow;

const styles = StyleSheet.create({
	row: {
		paddingVertical: 8,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	name: {
		flex: 1,
		fontWeight: "600",
	},
	newChip: {
		alignSelf: "flex-start",
	},
	controls: {
		flexDirection: "row",
		gap: 8,
		marginTop: 6,
		flexWrap: "wrap",
	},
	chip: {
		alignSelf: "flex-start",
	},
	divider: {
		marginTop: 10,
	},
});
