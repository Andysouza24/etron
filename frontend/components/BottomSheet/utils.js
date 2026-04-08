const DEFAULT_COLLAPSED_SNAP_POINT = "30%";
const DEFAULT_MAX_SNAP_POINT = "80%";

export const calculateMaxSheetHeight = (
  windowHeight,
  topInset = 0,
  maxHeightPercent = 80
) => {
  const availableHeight = windowHeight - topInset;
  return Math.floor(availableHeight * (maxHeightPercent / 100));
};

export const getMaxIndex = (enableDynamicSizing, snapPointsLength) =>
  enableDynamicSizing ? 1 : snapPointsLength - 1;

export const getSnapPoints = (enableDynamicSizing, customSnapPoints) => {
  const collapsedPoint =
    Array.isArray(customSnapPoints) && customSnapPoints.length > 0
      ? customSnapPoints[0]
      : DEFAULT_COLLAPSED_SNAP_POINT;

  if (enableDynamicSizing) {
    return [collapsedPoint];
  }

  if (Array.isArray(customSnapPoints) && customSnapPoints.length > 0) {
    return customSnapPoints;
  }

  return [collapsedPoint, DEFAULT_MAX_SNAP_POINT];
};

export const getInitialIndex = (
  enableDynamicSizing,
  customInitialIndex,
  snapPointsLength
) => {
  if (enableDynamicSizing) {
    return customInitialIndex === 0 ? 0 : 1;
  }

  if (typeof customInitialIndex === "number" && customInitialIndex >= 0) {
    return Math.min(customInitialIndex, snapPointsLength - 1);
  }

  return snapPointsLength - 1;
};

export const calculateAdjustedMaxContentSize = (
  keyboardHeight,
  maxDynamicContentSize,
  topInset,
  bottomInset,
  windowHeight
) => {
  if (keyboardHeight <= 0) return maxDynamicContentSize;

  const resolvedWindowHeight =
    typeof windowHeight === "number" ? windowHeight : undefined;

  if (typeof resolvedWindowHeight === "number") {
    const availableSpace =
      resolvedWindowHeight - keyboardHeight - topInset - bottomInset;
    return Math.floor(availableSpace * 0.9);
  }

  return maxDynamicContentSize;
};

export const constants = {
  DEFAULT_COLLAPSED_SNAP_POINT,
  DEFAULT_MAX_SNAP_POINT,
};
