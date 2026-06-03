import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";
import LinearGradient from "react-native-linear-gradient";

// Shimmer placeholder for a board/list card while data loads.
// The "large" size scales the card height, icons, and text lines up.
const PlaceholderBoard = ({ size = "small" }) => {
  const theme = useTheme();
  const isLarge = size === "large";

  const height = isLarge ? 160 : 80;
  const iconSize = isLarge ? 48 : 32;
  const textLineHeight = isLarge ? 14 : 10;
  const rightIconSize = isLarge ? 28 : 22;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceVariant,
          height,
          borderRadius: isLarge ? 12 : 8,
        },
      ]}
    >
      {/* Left element (icon/avatar placeholder) */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2 }}
        shimmerColors={[theme.colors.surfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]}
      />

      {/* Text block */}
      <View style={styles.textContainer}>
        <ShimmerPlaceholder
          LinearGradient={LinearGradient}
          style={{ width: "50%", height: textLineHeight, borderRadius: 4 }}
          shimmerColors={[theme.colors.surfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]}
        />
        <ShimmerPlaceholder
          LinearGradient={LinearGradient}
          style={{ width: "80%", height: textLineHeight, borderRadius: 4, marginTop: 6 }}
          shimmerColors={[theme.colors.surfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]}
        />
        {isLarge && (
          <ShimmerPlaceholder
            LinearGradient={LinearGradient}
            style={{ width: "70%", height: textLineHeight, borderRadius: 4, marginTop: 6 }}
            shimmerColors={[theme.colors.surfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]}
          />
        )}
      </View>

      {/* Right icon placeholder */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        style={{ width: rightIconSize, height: rightIconSize, borderRadius: rightIconSize / 2 }}
        shimmerColors={[theme.colors.surfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    marginVertical: 6,
    marginHorizontal: 12,
  },
  textContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
});

export default PlaceholderBoard;
