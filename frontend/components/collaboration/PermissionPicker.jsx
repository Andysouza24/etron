import { View } from "react-native";
import { Card, Checkbox, Chip, List, Text, useTheme } from "react-native-paper";
import { useState, useMemo } from "react";
import { collectDescendantKeys } from "../../utils/permissions/permissionTree";

// nested list of permissions grouped by section/category
// parent permissions implicitly grant their descendants
function PermissionPicker({ groups, selectedPerms, onChange }) {
    const theme = useTheme();
    const [openAccordions, setOpenAccordions] = useState({});
    const selectedSet = useMemo(() => new Set(selectedPerms), [selectedPerms]);

    const sections = useMemo(() => {
        const bySection = {};
        for (const group of groups) {
            (bySection[group.section] ||= []).push(group);
        }
        return Object.entries(bySection);
    }, [groups]);

    const isChecked = (perm) => selectedSet.has(perm.key);

    const setMany = (addKeys = [], removeKeys = []) => {
        const next = new Set(selectedSet);
        for (const k of addKeys) next.add(k);
        for (const k of removeKeys) next.delete(k);
        onChange(Array.from(next));
    };

    const togglePermission = (perm) => {
        const descendants = collectDescendantKeys(perm);
        if (isChecked(perm)) {
            // unchecking a parent clears every descendant
            setMany([], [perm.key, ...descendants]);
        } else {
            // checking a parent selects every descendant
            setMany([perm.key, ...descendants], []);
        }
    };

    const allKeysInGroup = (group) => {
        const out = [];
        const walk = (list) => {
            for (const p of list) {
                out.push(p.key);
                if (p.children?.length) walk(p.children);
            }
        };
        walk(group.permissions);
        return out;
    };

    const renderPermission = (perm, depth = 0) => {
        const checked = isChecked(perm);
        return (
            <View key={perm.key}>
                <Checkbox.Item
                    status={checked ? "checked" : "unchecked"}
                    onPress={() => togglePermission(perm)}
                    label={perm.label}
                    position="leading"
                    labelVariant="bodyMedium"
                    description={perm.description || undefined}
                    style={{ paddingLeft: depth * 16 }}
                />
                {/* children hidden while parent checked */}
                {!checked && perm.children?.length > 0
                    ? perm.children.map((child) => renderPermission(child, depth + 1))
                    : null}
            </View>
        );
    };

    return (
        <Card style={{ marginTop: 16 }}>
            <Card.Title title={`Permissions (${selectedPerms.length})`} />
            <Card.Content>
                {sections.map(([sectionLabel, categories]) => (
                    <View key={sectionLabel} style={{ marginBottom: 8 }}>
                        <Text style={{ marginBottom: 6, color: theme.colors.onSurfaceVariant }}>
                            {sectionLabel}
                        </Text>
                        {categories.map((category) => {
                            const open = !!openAccordions[category.categoryKey];
                            const groupKeys = allKeysInGroup(category);
                            const allSelected = groupKeys.length > 0 && groupKeys.every((k) => selectedSet.has(k));

                            const handleBulkToggle = () => {
                                if (allSelected) setMany([], groupKeys);
                                else setMany(groupKeys, []);
                            };

                            return (
                                <View key={category.categoryKey} style={{ marginBottom: 6 }}>
                                    <List.Accordion
                                        title={category.categoryLabel}
                                        expanded={open}
                                        onPress={() =>
                                            setOpenAccordions((s) => ({
                                                ...s,
                                                [category.categoryKey]: !s[category.categoryKey],
                                            }))
                                        }
                                    >
                                        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 }}>
                                            <Chip compact onPress={handleBulkToggle}>
                                                {allSelected ? "Clear" : "Select All"}
                                            </Chip>
                                        </View>
                                        <View style={{ paddingLeft: 4 }}>
                                            {category.permissions.map((perm) => renderPermission(perm))}
                                        </View>
                                    </List.Accordion>
                                </View>
                            );
                        })}
                    </View>
                ))}
                {groups.length === 0 ? <Text>No available permissions.</Text> : null}
            </Card.Content>
        </Card>
    );
}

export default PermissionPicker;
