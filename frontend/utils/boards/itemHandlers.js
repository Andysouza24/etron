import { v4 as uuidv4 } from "uuid";
import { getFirstAvailablePosition } from "../../components/layout/Grid/gridUtils";

const METRIC_WIDTH_RATIO = 2 / 3;
const METRIC_HEIGHT_UNITS = 2;
const TEXT_CHARACTERS_PER_UNIT = 12;
const TEXT_MIN_WIDTH_UNITS = 3;
const TEXT_MIN_HEIGHT_UNITS = 1;
const TEXT_MAX_HEIGHT_UNITS = 6;

const clampUnits = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumberOrFallback = (value, fallback) => {
  if (Number.isFinite(value)) {
    return value;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveButtonDefinition = (buttonConfig = {}, cols = 12) => {
  const destination = buttonConfig.destination;

  const label =
    buttonConfig.label ||
    (typeof destination === "object" ? destination?.label : undefined) ||
    "Button";

  const route =
    typeof destination === "object" && destination !== null
      ? destination.route || destination
      : destination || null;

  const icon =
    buttonConfig.icon ||
    (typeof destination === "object" ? destination?.icon : undefined) ||
    "arrow-right";

  const color = buttonConfig.color || "#2979FF";
  const widthUnits = calculateButtonGridWidth(label, cols);

  return {
    label,
    route,
    icon,
    color,
    widthUnits,
  };
};

export const calculateMetricGridWidth = (cols = 12) => {
  const minWidth = Math.ceil(cols * METRIC_WIDTH_RATIO);
  return clampUnits(minWidth || 1, 1, cols);
};

export const calculateButtonGridWidth = (label = "", cols = 12) => {
  const textLength = label.length;

  const widthThresholds = [
    { max: 10, width: 4 },
    { max: 20, width: 5 },
    { max: 30, width: 6 },
    { max: 40, width: 7 },
    { max: 50, width: 8 },
  ];

  const baseWidth = widthThresholds.reduce(
    (currentWidth, threshold) =>
      textLength > threshold.max ? threshold.width : currentWidth,
    4
  );

  const resolvedWidth = textLength > 50 ? cols : baseWidth;

  return clampUnits(resolvedWidth, 1, cols);
};

export const calculateTextGridWidth = (text = "", cols = 12) => {
  if (cols <= 0) return 1;

  const lines = typeof text === "string" ? text.split(/\r?\n/) : [""];
  const longestLineLength = lines.reduce(
    (max, line) => Math.max(max, line.trim().length),
    0
  );

  const estimatedUnits = Math.ceil(
    Math.max(longestLineLength, TEXT_CHARACTERS_PER_UNIT) /
      TEXT_CHARACTERS_PER_UNIT
  );

  const normalizedUnits = Number.isFinite(estimatedUnits)
    ? estimatedUnits
    : TEXT_MIN_WIDTH_UNITS;

  return clampUnits(normalizedUnits, TEXT_MIN_WIDTH_UNITS, cols);
};

export const calculateTextGridHeight = (text = "") => {
  const lineCount = Math.max(
    TEXT_MIN_HEIGHT_UNITS,
    typeof text === "string" ? text.split(/\r?\n/).length : 1
  );

  if (lineCount <= 2) return 1;
  if (lineCount <= 4) return 2;
  if (lineCount <= 6) return 3;
  return Math.min(TEXT_MAX_HEIGHT_UNITS, Math.ceil(lineCount / 2));
};

export const createMetricItem = (metric, existingLayout, cols = 12) => {
  const metricWidth = calculateMetricGridWidth(cols);
  const position = getFirstAvailablePosition(
    existingLayout,
    metricWidth,
    METRIC_HEIGHT_UNITS,
    cols
  );

  const rawConfig = metric?.config || {};
  const chartType = rawConfig.type || metric?.chartType || "line";
  const independentVariable =
    rawConfig.independentVariable ?? metric?.independentVariable;
  const dependentVariables = Array.isArray(rawConfig.dependentVariables)
    ? rawConfig.dependentVariables
    : Array.isArray(metric?.dependentVariables)
    ? metric.dependentVariables
    : [];
  const selectedRows = Array.isArray(rawConfig.selectedRows)
    ? rawConfig.selectedRows
    : Array.isArray(metric?.selectedRows)
    ? metric.selectedRows
    : [];
  const resolvedColours = Array.isArray(rawConfig.colours)
    ? rawConfig.colours
    : Array.isArray(rawConfig.colors)
    ? rawConfig.colors
    : Array.isArray(metric?.colours)
    ? metric.colours
    : Array.isArray(metric?.colors)
    ? metric.colors
    : [];
  const appearance = rawConfig.appearance || metric?.appearance || {};
  const label = rawConfig.label || metric?.label || metric?.name || "Metric";

  return {
    id: uuidv4(),
    type: "metric",
    x: position.x,
    y: position.y,
    w: metricWidth,
    h: METRIC_HEIGHT_UNITS,
    config: {
      metricId: metric.metricId,
      dataSourceId: metric.dataSourceId,
      name: metric.name,
      label,
      chartType,
      independentVariable,
      dependentVariables,
      selectedRows,
      colours: resolvedColours,
      colors: resolvedColours,
      appearance,
    },
  };
};

export const createButtonItem = (buttonConfig, existingLayout, cols = 12) => {
  const { label, route, icon, color, widthUnits } = resolveButtonDefinition(
    buttonConfig,
    cols
  );

  const position = getFirstAvailablePosition(
    existingLayout,
    widthUnits,
    1,
    cols
  );

  return {
    id: uuidv4(),
    type: "button",
    x: position.x,
    y: position.y,
    w: widthUnits,
    h: 1,
    config: {
      label: label,
      destination: route,
      color: color,
      icon,
      buttonProps: {
        icon,
      },
    },
  };
};

export const createTextItem = (textConfig = {}, existingLayout, cols = 12) => {
  const textValue = typeof textConfig.text === "string" ? textConfig.text : "";
  const alignment = textConfig.alignment || "left";
  const normalizedFontSize = Math.max(
    1,
    toNumberOrFallback(textConfig.fontSize, 18)
  );
  const normalizedLineHeight = Math.max(
    1,
    toNumberOrFallback(
      textConfig.lineHeight,
      Math.round(normalizedFontSize * 1.3)
    )
  );
  const normalizedPadding = Math.max(
    0,
    toNumberOrFallback(textConfig.padding, 16)
  );
  const normalizedText = textValue.trim() || "New text";

  const widthUnits = calculateTextGridWidth(normalizedText, cols);
  const heightUnits = clampUnits(
    calculateTextGridHeight(normalizedText),
    TEXT_MIN_HEIGHT_UNITS,
    TEXT_MAX_HEIGHT_UNITS
  );

  const position = getFirstAvailablePosition(
    existingLayout,
    widthUnits,
    heightUnits,
    cols
  );

  const minWidthUnits = Math.max(
    TEXT_MIN_WIDTH_UNITS,
    textConfig.minWidthUnits ?? TEXT_MIN_WIDTH_UNITS
  );
  const minHeightUnits = Math.max(
    TEXT_MIN_HEIGHT_UNITS,
    textConfig.minHeightUnits ?? TEXT_MIN_HEIGHT_UNITS
  );

  const maxWidthUnits = Math.max(
    minWidthUnits,
    Math.min(textConfig.maxWidthUnits ?? cols, cols)
  );
  const maxHeightUnits = Math.max(
    minHeightUnits,
    Math.min(
      textConfig.maxHeightUnits ?? TEXT_MAX_HEIGHT_UNITS,
      TEXT_MAX_HEIGHT_UNITS
    )
  );

  return {
    id: uuidv4(),
    type: "text",
    x: position.x,
    y: position.y,
    w: widthUnits,
    h: heightUnits,
    config: {
      text: normalizedText,
      alignment,
      fontSize: normalizedFontSize,
      padding: normalizedPadding,
      textColor: textConfig.textColor || "",
      backgroundColor: textConfig.backgroundColor || "",
      lineHeight: normalizedLineHeight,
      maxLines: textConfig.maxLines || undefined,
      minWidthUnits,
      minHeightUnits,
      maxWidthUnits,
      maxHeightUnits,
    },
  };
};

export const mapItemsToLayout = (items = [], cols = 12) => {
  const metricWidth = calculateMetricGridWidth(cols);

  return items.map((item) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    w:
      item.type === "metric"
        ? Math.min(Math.max(item.w ?? 1, metricWidth), cols)
        : item.type === "text"
        ? Math.min(
            Math.max(
              item.w ?? TEXT_MIN_WIDTH_UNITS,
              item.config?.minWidthUnits ?? TEXT_MIN_WIDTH_UNITS
            ),
            cols
          )
        : item.w,
    h:
      item.type === "metric"
        ? Math.max(item.h ?? METRIC_HEIGHT_UNITS, METRIC_HEIGHT_UNITS)
        : item.type === "text"
        ? Math.max(
            item.h ?? TEXT_MIN_HEIGHT_UNITS,
            item.config?.minHeightUnits ?? TEXT_MIN_HEIGHT_UNITS
          )
        : item.h,
  }));
};
