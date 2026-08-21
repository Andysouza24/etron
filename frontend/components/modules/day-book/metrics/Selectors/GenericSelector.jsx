import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import DropDown from "../../../../common/input/DropDown";

// Shared labelled dropdown used by the metric selector components.
// Renders an optional heading above a DropDown; callers supply the items,
// value, and onChange. `wrapInView` matches each caller's original layout
// (a View container vs an inline fragment) so the rendered tree is unchanged.
export default function GenericSelector({
    label,
    labelVariant = "labelLarge",
    title,
    items = [],
    value,
    onChange,
    showRouterButton = false,
    wrapInView = false,
}) {
    const content = (
        <>
            {label != null && <Text variant={labelVariant}>{label}</Text>}
            <DropDown
                title={title}
                items={items}
                showRouterButton={showRouterButton}
                onSelect={onChange}
                value={value}
            />
        </>
    );

    return wrapInView ? <View>{content}</View> : content;
}
