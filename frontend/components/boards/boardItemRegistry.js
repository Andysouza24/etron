import React from "react";
import { View, TouchableOpacity } from "react-native";
import MetricCard from "./MetricCard";
import ButtonCard from "./ButtonCard";
import TextCard from "./TextCard";
import {
  calculateButtonGridWidth,
  calculateMetricGridWidth,
  calculateTextGridHeight,
  calculateTextGridWidth,
} from "../../utils/boards/itemHandlers";

const createBaseDefinitions = ({
  gridCols,
  defaultMetricMaxHeight,
  defaultButtonMaxHeight,
}) => {
  const metricMinWidth = calculateMetricGridWidth(gridCols);

  return {
    metric: {
      type: "metric",
      label: "Metric",
      description: "Add a data metric visualization",
      icon: "chart-line",
      computeMinWidth: ({ configMinWidth }) =>
        Math.max(configMinWidth, metricMinWidth),
      computeMaxHeightFallback: ({ configMinHeight, item }) =>
        Math.max(
          configMinHeight,
          item.config?.maxHeightUnits ?? defaultMetricMaxHeight
        ),
      renderContent: ({
        item,
        editingActive,
        styles,
        handlers,
        metricStates,
        isResizeActive,
      }) => (
        <MetricCard
          item={item}
          metricState={metricStates[item.id]}
          isEditing={editingActive}
          styles={styles}
          onEdit={handlers.openItemOptions}
          onPress={handlers.openMetricDetails}
          disableEditActions={isResizeActive}
        />
      ),
      isPressable: ({ editingActive }) => !editingActive,
      onPress: ({ handlers, item }) => handlers.openMetricDetails?.(item.id),
      buildOption: (creationHandlers) =>
        creationHandlers.metric
          ? {
              key: "metric",
              title: "Metric",
              description: "Add a data metric visualization",
              icon: "chart-line",
              onPress: creationHandlers.metric,
            }
          : null,
    },
    button: {
      type: "button",
      label: "Button",
      description: "Add a navigation button",
      icon: "gesture-tap-button",
      computeMinWidth: ({ item, configMinWidth }) =>
        Math.max(
          configMinWidth,
          calculateButtonGridWidth(item.config?.label || "Button", gridCols)
        ),
      computeMaxHeightFallback: ({ configMinHeight, item }) =>
        Math.max(
          configMinHeight,
          item.config?.maxHeightUnits ?? defaultButtonMaxHeight
        ),
      renderContent: ({ item, editingActive, handlers, isResizeActive }) => (
        <ButtonCard
          item={item}
          isEditing={editingActive}
          onEdit={handlers.openItemOptions}
          disableEditActions={isResizeActive}
        />
      ),
      buildOption: (creationHandlers) =>
        creationHandlers.button
          ? {
              key: "button",
              title: "Button",
              description: "Add a navigation button",
              icon: "gesture-tap-button",
              onPress: creationHandlers.button,
            }
          : null,
    },
    text: {
      type: "text",
      label: "Text",
      description: "Add a formatted text block",
      icon: "format-text",
      computeMinWidth: ({ item, configMinWidth }) =>
        Math.max(
          configMinWidth,
          calculateTextGridWidth(item.config?.text || "", gridCols)
        ),
      computePreferredHeight: ({ item }) =>
        calculateTextGridHeight(item.config?.text || ""),
      computeMaxHeightFallback: ({ configMinHeight, item }) =>
        Math.max(
          configMinHeight,
          item.config?.maxHeightUnits ??
            calculateTextGridHeight(item.config?.text || "")
        ),
      renderContent: ({ item, editingActive, handlers, isResizeActive }) => (
        <TextCard
          item={item}
          isEditing={editingActive}
          onEdit={handlers.openItemOptions}
          disableEditActions={isResizeActive}
        />
      ),
      buildOption: (creationHandlers) =>
        creationHandlers.text
          ? {
              key: "text",
              title: "Text",
              description: "Add a formatted text block",
              icon: "format-text",
              onPress: creationHandlers.text,
            }
          : null,
    },
  };
};

const computeLayoutDimensions = ({ item, gridCols, definition, context }) => {
  const baseWidth = typeof item.w === "number" ? item.w : 1;
  const baseHeight = typeof item.h === "number" ? item.h : 1;
  const config = item.config || {};

  const configMinWidth = Math.max(1, config.minWidthUnits ?? 1);
  const configMinHeight = Math.max(1, config.minHeightUnits ?? 1);

  const minWidthFromDefinition = definition.computeMinWidth
    ? definition.computeMinWidth({ item, configMinWidth, context })
    : configMinWidth;

  let minWidthUnits = Math.max(configMinWidth, minWidthFromDefinition);
  minWidthUnits = Math.min(minWidthUnits, gridCols);

  let widthUnits = Math.max(baseWidth, minWidthUnits);
  widthUnits = Math.min(widthUnits, gridCols);

  let xPosition = typeof item.x === "number" ? item.x : 0;
  if (xPosition + widthUnits > gridCols) {
    xPosition = Math.max(0, gridCols - widthUnits);
  }

  const availableWidth = Math.max(1, gridCols - xPosition);
  const configuredMaxWidth = config.maxWidthUnits ?? availableWidth;
  const maxWidthUnits = Math.max(
    widthUnits,
    Math.min(configuredMaxWidth, availableWidth)
  );

  const fallbackHeight = definition.computeMaxHeightFallback
    ? definition.computeMaxHeightFallback({ item, configMinHeight, context })
    : config.maxHeightUnits ?? configMinHeight + 4;

  const configuredMaxHeight = Math.max(configMinHeight, fallbackHeight);

  let heightUnits = Math.max(baseHeight, configMinHeight);
  if (typeof definition.computePreferredHeight === "function") {
    const preferredHeight = definition.computePreferredHeight({
      item,
      configMinHeight,
      context,
    });
    if (typeof preferredHeight === "number" && preferredHeight > 0) {
      heightUnits = Math.max(heightUnits, preferredHeight);
    }
  }
  heightUnits = Math.min(heightUnits, configuredMaxHeight);

  return {
    xPosition,
    widthUnits,
    heightUnits,
    resizeConstraints: {
      minWidth: Math.max(1, minWidthUnits),
      minHeight: Math.max(1, configMinHeight),
      maxWidth: maxWidthUnits,
      maxHeight: configuredMaxHeight,
    },
  };
};

const createWrapper = ({
  definition,
  editingActive,
  handlers,
  styles,
  item,
  content,
}) => {
  const isPressable =
    definition.isPressable?.({ item, editingActive }) ?? false;
  const handlePress = definition.onPress;

  if (!isPressable || typeof handlePress !== "function") {
    return <View style={styles.itemContent}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.itemContent}
      activeOpacity={0.7}
      onPress={() => handlePress({ item, handlers })}
    >
      {content}
    </TouchableOpacity>
  );
};

export const createGridItemBuilder = ({
  gridCols,
  defaultMetricMaxHeight,
  defaultButtonMaxHeight,
  typeOverrides = {},
}) => {
  const definitions = {
    ...createBaseDefinitions({
      gridCols,
      defaultMetricMaxHeight,
      defaultButtonMaxHeight,
    }),
    ...typeOverrides,
  };

  const build = ({
    items,
    editingActive,
    metricStates,
    isResizeActive,
    styles,
    handlers,
  }) => {
    if (!items) return [];

    return items.map((item) => {
      const definition = definitions[item.type];
      if (!definition) {
        return {
          id: item.id,
          x: item.x ?? 0,
          y: item.y ?? 0,
          w: item.w ?? 1,
          h: item.h ?? 1,
          resizeConstraints: {
            minWidth: Math.max(1, item.config?.minWidthUnits ?? 1),
            minHeight: Math.max(1, item.config?.minHeightUnits ?? 1),
            maxWidth: Math.max(1, item.config?.maxWidthUnits ?? 1),
            maxHeight: Math.max(1, item.config?.maxHeightUnits ?? 1),
          },
          content: <View style={styles.itemContent} />,
        };
      }

      const layout = computeLayoutDimensions({
        item,
        gridCols,
        definition,
        context: {
          gridCols,
          defaultMetricMaxHeight,
          defaultButtonMaxHeight,
        },
      });

      const content = definition.renderContent({
        item,
        editingActive,
        styles,
        handlers,
        metricStates,
        isResizeActive,
      });

      return {
        id: item.id,
        x: layout.xPosition,
        y: typeof item.y === "number" ? item.y : 0,
        w: layout.widthUnits,
        h: layout.heightUnits,
        resizeConstraints: layout.resizeConstraints,
        content: createWrapper({
          definition,
          editingActive,
          handlers,
          styles,
          item,
          content,
        }),
      };
    });
  };

  build.definitions = definitions;

  return build;
};

export const createAddItemOptions = (definitions, creationHandlers = {}) =>
  Object.values(definitions)
    .map((definition) => definition.buildOption?.(creationHandlers))
    .filter(Boolean);

export default createGridItemBuilder;
