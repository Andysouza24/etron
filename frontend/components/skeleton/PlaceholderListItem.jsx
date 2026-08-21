import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";
import LinearGradient from "react-native-linear-gradient";

// Shimmer placeholder for a single list row (icon, two text lines, trailing icon).
const PlaceholderListItem = () => {
  const theme = useTheme();

  const shimmerColors = [
    theme.colors.surfaceVariant,
    theme.colors.surface,
    theme.colors.surfaceVariant,
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      {/* Left Icon Placeholder */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        style={styles.leftIcon}
        shimmerColors={shimmerColors}
      />

      {/* Text Container */}
      <View style={styles.textContainer}>
        <ShimmerPlaceholder
          LinearGradient={LinearGradient}
          style={styles.titleLine}
          shimmerColors={shimmerColors}
        />
        <ShimmerPlaceholder
          LinearGradient={LinearGradient}
          style={styles.descriptionLine}
          shimmerColors={shimmerColors}
        />
      </View>

      {/* Right Icon Placeholder */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        style={styles.rightIcon}
        shimmerColors={shimmerColors}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  leftIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  textContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  titleLine: {
    width: "60%",
    height: 10,
    borderRadius: 4,
  },
  descriptionLine: {
    width: "80%",
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  rightIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
});

export default PlaceholderListItem;