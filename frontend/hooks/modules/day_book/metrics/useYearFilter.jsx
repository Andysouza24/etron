// Year discovery + selection for the legacy year-segmented selector.
//
// Operates in two modes:
//   Controlled  - parent passes `availableYearsProp`, `selectedYearProp`,
//                 and `onYearChange`. Picking fires the callback (expected
//                 to refetch from the backend). The hook only renders state.
//   Uncontrolled - parent omits `onYearChange`. Years are derived from the
//                  dataset and the selection is tracked locally, defaulting
//                  to the most recent year.

import { useEffect, useMemo, useState } from "react";
import { deriveYears } from "../../../../utils/metricDateUtils";

const useYearFilter = ({
    sortedData,
    xKey,
    chartType,
    timeSeriesTypes,
    availableYearsProp,
    selectedYearProp,
    onYearChange,
    enabled = true,
}) => {
    const isControlled = typeof onYearChange === "function";

    const derivedYears = useMemo(() => {
        if (!enabled || !timeSeriesTypes.has(chartType)) return [];
        return deriveYears(sortedData, xKey);
    }, [enabled, timeSeriesTypes, chartType, sortedData, xKey]);

    const availableYears = useMemo(() => {
        if (Array.isArray(availableYearsProp) && availableYearsProp.length > 0) {
            return [...availableYearsProp].sort((a, b) => a - b);
        }
        return derivedYears;
    }, [availableYearsProp, derivedYears]);

    // Local fallback year, initialised to the most recent available year.
    const [localYear, setLocalYear] = useState(null);
    useEffect(() => {
        if (availableYears.length === 0) return;
        if (localYear != null && availableYears.includes(localYear)) return;
        const next = (selectedYearProp != null && availableYears.includes(selectedYearProp))
            ? selectedYearProp
            : availableYears[availableYears.length - 1];
        setLocalYear(next);
    }, [selectedYearProp, availableYears, localYear]);

    const selectedYear = isControlled
        ? (selectedYearProp ?? availableYears[availableYears.length - 1] ?? null)
        : (localYear ?? selectedYearProp ?? availableYears[availableYears.length - 1] ?? null);

    const setSelectedYear = (year) => {
        if (isControlled) onYearChange(year);
        else setLocalYear(year);
    };

    return {
        availableYears,
        selectedYear,
        setSelectedYear,
        isControlled,
    };
};

export default useYearFilter;
