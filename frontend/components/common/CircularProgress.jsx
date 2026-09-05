// Author(s): Holly Wyatt

import { View } from "react-native";
import { ActivityIndicator, useTheme } from "react-native-paper";
import Svg, { Circle } from "react-native-svg";

// Circular progress indicator. Falls back to a spinner when `progress`
// is not a number (indeterminate); otherwise draws a clamped 0–1 arc.
const CircularProgress = ({
    progress,
    size = 40,
    strokeWidth = 4,
    color,
    trackColor,
    style,
    accessibilityLabel,
}) => {
    const theme = useTheme();
    const stroke = color || theme.colors.primary;
    const track = trackColor || theme.colors.surfaceVariant;

    const isIndeterminate = typeof progress !== "number";

    if (isIndeterminate) {
        return (
            <ActivityIndicator
                size={size}
                color={stroke}
                style={style}
                accessibilityLabel={accessibilityLabel}
            />
        );
    }

    const clamped = Math.max(0, Math.min(1, progress));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <View
            style={[{ width: size, height: size }, style]}
            accessibilityRole="progressbar"
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        >
            <View
                style={{
                    width: size,
                    height: size,
                    transform: [{ rotate: "-90deg" }],
                }}
            >
                <Svg width={size} height={size}>
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={track}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={circumference * (1 - clamped)}
                    />
                </Svg>
            </View>
        </View>
    );
};

export default CircularProgress;

