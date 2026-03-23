import { sanitizeHexColor, isValidHexColor } from "../color";
import {
  DEFAULT_BOARD_COLOUR,
  BOARD_COLOUR_PALETTE,
  DEFAULT_CHART_APPEARANCE,
  INITIAL_DISPLAY_SETTINGS,
} from "./boardConstants";

export const sanitizeColourValue = sanitizeHexColor;
export const isValidHexColour = isValidHexColor;

export const createDisplaySettingsDraft = () => ({
  ...INITIAL_DISPLAY_SETTINGS,
});

const parseAxisLabelAngle = (value) => {
  if (value === undefined || value === null) {
    return DEFAULT_CHART_APPEARANCE.xAxisLabelAngle;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return DEFAULT_CHART_APPEARANCE.xAxisLabelAngle;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_CHART_APPEARANCE.xAxisLabelAngle;
    }

    return Math.max(-90, Math.min(90, numeric));
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return DEFAULT_CHART_APPEARANCE.xAxisLabelAngle;
    }
    return Math.max(-90, Math.min(90, value));
  }

  return DEFAULT_CHART_APPEARANCE.xAxisLabelAngle;
};

const resolveTickTextAnchor = (angle) => {
  if (!Number.isFinite(angle) || angle === 0) {
    return "middle";
  }
  return angle > 0 ? "start" : "end";
};

export const buildDisplayColoursForItem = (item) => {
  if (!item) {
    return [DEFAULT_BOARD_COLOUR];
  }

  const dependentVariables = Array.isArray(item.config?.dependentVariables)
    ? item.config.dependentVariables
    : [];

  const rawColours = Array.isArray(item.config?.colours)
    ? item.config.colours
    : Array.isArray(item.config?.colors)
    ? item.config.colors
    : [];

  const savedColours = rawColours.filter(Boolean);

  if (dependentVariables.length === 0) {
    return savedColours.length
      ? savedColours.map(
          (colour, index) =>
            sanitizeColourValue(colour) ||
            BOARD_COLOUR_PALETTE[index % BOARD_COLOUR_PALETTE.length]
        )
      : [DEFAULT_BOARD_COLOUR];
  }

  const colours = dependentVariables.map((_, index) => {
    const saved = savedColours[index];
    const fallback = BOARD_COLOUR_PALETTE[index % BOARD_COLOUR_PALETTE.length];
    return sanitizeColourValue(saved) || fallback;
  });

  return colours.length ? colours : [DEFAULT_BOARD_COLOUR];
};

export const resolveAppearance = (appearance) => ({
  background: appearance?.background || DEFAULT_CHART_APPEARANCE.background,
  axisColor: appearance?.axisColor || DEFAULT_CHART_APPEARANCE.axisColor,
  tickLabelColor:
    appearance?.tickLabelColor || DEFAULT_CHART_APPEARANCE.tickLabelColor,
  gridColor: appearance?.gridColor || DEFAULT_CHART_APPEARANCE.gridColor,
  showGrid:
    appearance?.showGrid !== undefined
      ? appearance.showGrid
      : DEFAULT_CHART_APPEARANCE.showGrid,
  xAxisLabelAngle: parseAxisLabelAngle(appearance?.xAxisLabelAngle),
});

export const buildAxisOptionsFromAppearance = (appearance) => {
  const xAxisLabelAngle = parseAxisLabelAngle(appearance?.xAxisLabelAngle);
  const axisStyle = {
    axis: { stroke: appearance.axisColor },
    ticks: { stroke: appearance.axisColor },
    tickLabels: { fill: appearance.tickLabelColor },
    axisLabel: { fill: appearance.tickLabelColor },
    grid: {
      stroke: appearance.showGrid ? appearance.gridColor : "transparent",
    },
  };

  const xAxisStyle = {
    ...axisStyle,
    tickLabels: {
      ...axisStyle.tickLabels,
      angle: xAxisLabelAngle,
      textAnchor: resolveTickTextAnchor(xAxisLabelAngle),
    },
  };

  const yAxisStyle = {
    ...axisStyle,
    tickLabels: {
      ...axisStyle.tickLabels,
    },
  };

  return {
    x: { style: xAxisStyle },
    y: { style: yAxisStyle },
  };
};

export const mergeAxisOptions = (base, override) => {
  const result = { ...base };

  if (!override) {
    return result;
  }

  Object.entries(override).forEach(([axisKey, axisValue]) => {
    if (!axisValue) return;

    const baseAxis = result[axisKey] || {};
    const merged = { ...baseAxis, ...axisValue };

    if (baseAxis.style || axisValue.style) {
      merged.style = { ...baseAxis.style, ...axisValue.style };
    }

    result[axisKey] = merged;
  });

  return result;
};

export const formatMetricValue = (value) => {
  if (value === null || value === undefined) return "N/A";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "N/A";
    if (Math.abs(value) >= 1000) {
      try {
        return value.toLocaleString();
      } catch (error) {
        return `${Math.round(value)}`;
      }
    }
    if (Math.abs(value) >= 10) {
      return `${Math.round(value * 10) / 10}`;
    }
    return `${Math.round(value * 100) / 100}`;
  }

  return `${value}`;
};

export const formatRangeValue = (value) => {
  if (value === null || value === undefined) return "N/A";

  if (value instanceof Date) {
    return value.toLocaleDateString?.() || value.toDateString();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      return date.toLocaleDateString?.() || date.toDateString();
    }
    return value;
  }

  if (typeof value === "number") {
    return formatMetricValue(value);
  }

  return `${value}`;
};
