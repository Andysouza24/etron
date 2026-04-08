import { useState, useMemo } from "react";
import { DEFAULT_BOARD_COLOUR } from "../utils/boards/boardConstants";
import {
  createDisplaySettingsDraft,
  buildDisplayColoursForItem,
} from "../utils/boards/boardUtils";

export const useDisplaySettings = (board) => {
  const [displayConfigItemId, setDisplayConfigItemId] = useState(null);
  const [displayConfigDraft, setDisplayConfigDraft] = useState(() =>
    createDisplaySettingsDraft()
  );

  const displayConfigItem = useMemo(() => {
    if (!board?.items || !displayConfigItemId) return null;
    return board.items.find((item) => item.id === displayConfigItemId) || null;
  }, [board?.items, displayConfigItemId]);

  const displayColourLabels = useMemo(() => {
    if (!displayConfigItem) {
      const colourCount = Array.isArray(displayConfigDraft.colours)
        ? displayConfigDraft.colours.length
        : 0;
      return Array.from(
        { length: colourCount },
        (_, index) => `Series ${index + 1}`
      );
    }

    const dependentVariables = Array.isArray(
      displayConfigItem.config?.dependentVariables
    )
      ? displayConfigItem.config.dependentVariables
      : [];

    if (dependentVariables.length > 0) {
      return dependentVariables;
    }

    const colourCount = Array.isArray(displayConfigDraft.colours)
      ? displayConfigDraft.colours.length
      : 0;
    return Array.from(
      { length: colourCount },
      (_, index) => `Series ${index + 1}`
    );
  }, [displayConfigItem, displayConfigDraft.colours]);

  const openDisplaySettings = (item) => {
    if (!item) return;

    setDisplayConfigItemId(item.id);
    const appearance = item.config?.appearance || {};
    const initialColours = buildDisplayColoursForItem(item);
    const angleValue = appearance?.xAxisLabelAngle;
    let draftAngle = "";

    if (typeof angleValue === "number" && Number.isFinite(angleValue)) {
      draftAngle = `${angleValue}`;
    } else if (typeof angleValue === "string" && angleValue.trim().length > 0) {
      draftAngle = angleValue.trim();
    }

    setDisplayConfigDraft({
      label: item.config?.label || item.config?.name || "",
      colours: initialColours,
      background: appearance.background || "",
      axisColor: appearance.axisColor || "",
      tickLabelColor: appearance.tickLabelColor || "",
      gridColor: appearance.gridColor || "",
      showGrid: appearance.showGrid !== undefined ? appearance.showGrid : true,
      xAxisLabelAngle: draftAngle,
    });
  };

  const closeDisplaySettings = () => {
    setDisplayConfigItemId(null);
    setDisplayConfigDraft(createDisplaySettingsDraft());
  };

  const updateDraft = (updates) => {
    setDisplayConfigDraft((prev) => ({ ...prev, ...updates }));
  };

  const resetColours = () => {
    if (!displayConfigItem) return;
    const initialColours = buildDisplayColoursForItem(displayConfigItem);
    setDisplayConfigDraft((prev) => ({ ...prev, colours: initialColours }));
  };

  const resetAppearance = () => {
    if (!displayConfigItem) return;
    const appearance = displayConfigItem.config?.appearance || {};
    setDisplayConfigDraft((prev) => ({
      ...prev,
      background: appearance.background || "",
      axisColor: appearance.axisColor || "",
      tickLabelColor: appearance.tickLabelColor || "",
      gridColor: appearance.gridColor || "",
      showGrid: appearance.showGrid !== undefined ? appearance.showGrid : true,
      xAxisLabelAngle:
        typeof appearance.xAxisLabelAngle === "number" &&
        Number.isFinite(appearance.xAxisLabelAngle)
          ? `${appearance.xAxisLabelAngle}`
          : typeof appearance.xAxisLabelAngle === "string" &&
            appearance.xAxisLabelAngle.trim().length > 0
          ? appearance.xAxisLabelAngle.trim()
          : "",
    }));
  };

  return {
    displayConfigItem,
    displayConfigDraft,
    displayColourLabels,
    openDisplaySettings,
    closeDisplaySettings,
    updateDraft,
    resetColours,
    resetAppearance,
  };
};
