import { Chip, useTheme } from "react-native-paper";

const SelectableChip = ({
    children,
    selected = false,
    onPress,
    showSelectedCheck = false,
    style,
    accessibilityLabel,
    ...rest
}) => {
    const theme = useTheme();

    return (
        <Chip
            selected={selected}
            onPress={onPress}
            showSelectedCheck={showSelectedCheck}
            mode="flat"
            style={[
                {
                    backgroundColor: selected
                        ? theme.colors.secondaryContainer
                        : theme.colors.surfaceVariant,
                },
                style,
            ]}
            textStyle={{
                color: selected
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurfaceVariant,
            }}
            accessibilityLabel={accessibilityLabel}
            {...rest}
        >
            {children}
        </Chip>
    );
};

export default SelectableChip;
