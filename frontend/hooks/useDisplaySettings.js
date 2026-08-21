import { useState, useMemo } from "react";
import { DEFAULT_BOARD_COLOUR } from "../utils/boards/boardConstants";
import {
  createDisplaySettingsDraft,
  buildDisplayColoursForItem,
  mergeAppearance,
} from "../utils/boards/boardUtils";

export const useDisplaySettings = (board) => {
  const [displayConfigItemId, setDisplayConfigItemId] = useState(null);
  const [displayConfigDraft, setDisplayConfigDraft] = useState(() =>
    createDisplaySettingsDraft()
  );
  // Effective (metric + board override) appearance captured when the modal
  // was opened. Used so save/reset can compare draft values against the
  // inherited baseline and only persist genuine board-level overrides.
  const [inheritedAppearance, setInheritedAppearance] = useState({});

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

  const buildDraftFromAppearance = (item, appearance) => {
    const angleValue = appearance?.xAxisLabelAngle;
    let draftAngle = "";

    if (typeof angleValue === "number" && Number.isFinite(angleValue)) {
      draftAngle = `${angleValue}`;
    } else if (typeof angleValue === "string" && angleValue.trim().length > 0) {
      draftAngle = angleValue.trim();
    }

    return {
      label: item.config?.label || item.config?.name || "",
      colours: buildDisplayColoursForItem(item),
      background: appearance.background || "",
      axisColor: appearance.axisColor || "",
      tickLabelColor: appearance.tickLabelColor || "",
      gridColor: appearance.gridColor || "",
      showGrid:
        appearance.showGrid !== undefined ? appearance.showGrid : true,
      xAxisLabelAngle: draftAngle,
    };
  };

  const openDisplaySettings = (item, metricAppearance) => {
    if (!item) return;

    setDisplayConfigItemId(item.id);
    const effective = mergeAppearance(metricAppearance, item.config?.appearance);
    const inherited = mergeAppearance(metricAppearance);
    setInheritedAppearance(inherited);
    setDisplayConfigDraft(buildDraftFromAppearance(item, effective));
  };

  const closeDisplaySettings = () => {
    setDisplayConfigItemId(null);
    setDisplayConfigDraft(createDisplaySettingsDraft());
    setInheritedAppearance({});
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
    const effective = mergeAppearance(
      inheritedAppearance,
      displayConfigItem.config?.appearance
    );
    setDisplayConfigDraft((prev) => ({
      ...prev,
      ...buildDraftFromAppearance(displayConfigItem, effective),
      // preserve the in-progress label/colours edits — only appearance fields reset
      label: prev.label,
      colours: prev.colours,
    }));
  };

  return {
    displayConfigItem,
    displayConfigDraft,
    displayColourLabels,
    inheritedAppearance,
    openDisplaySettings,
    closeDisplaySettings,
    updateDraft,
    resetColours,
    resetAppearance,
  };
};
