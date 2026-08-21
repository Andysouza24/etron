// Drives the create-metric wizard preview using the same backend pipeline
// (`previewMetricData`) that view-metric uses, so the preview chart matches
// the saved metric exactly. Debounces config changes to avoid hammering
// Athena while the user edits the form.

import { useEffect, useMemo, useRef, useState } from "react";
import metricDataService from "../../../../services/MetricDataService";
import { toBackendAggregatePeriod } from "../../../../utils/metricAggregationPeriod";

const DEBOUNCE_MS = 350;

export default function useMetricPreview(dataSourceId, config, options = {}) {
    const { aggregationPeriod = "daily" } = options;
    const [data, setData] = useState([]);
    const [yKeys, setYKeys] = useState([]);
    const [availableYears, setAvailableYears] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Stable signature so we only refetch when fields that affect the
    // backend SQL actually change.
    const signature = useMemo(() => {
        if (!dataSourceId || !config) return null;
        const { independentVariable, dependentVariables, aggregation, dimensionField, selectedRows } = config;
        if (!independentVariable) return null;
        if (!dimensionField && (!Array.isArray(dependentVariables) || dependentVariables.length === 0)) return null;
        return JSON.stringify({
            dataSourceId,
            independentVariable,
            dependentVariables: dependentVariables ?? [],
            aggregation: aggregation ?? null,
            dimensionField: dimensionField ?? null,
            selectedRows: selectedRows ?? [],
            aggregatePeriod: toBackendAggregatePeriod(aggregationPeriod),
        });
    }, [dataSourceId, config, aggregationPeriod]);

    const requestRef = useRef(0);

    useEffect(() => {
        if (!signature) {
            setData([]);
            setYKeys([]);
            setAvailableYears(null);
            setSelectedYear(null);
            setError(null);
            return undefined;
        }

        const requestId = ++requestRef.current;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            const response = await metricDataService.previewMetricData(dataSourceId, config, {
                // Mirror view-metric: pull every year so the preview chart
                // can page across the full dataset instead of being capped
                // by the backend's default most-recent-year filter.
                year: selectedYear ?? "all",
                aggregatePeriod: toBackendAggregatePeriod(aggregationPeriod),
            });
            if (requestRef.current !== requestId) return;

            if (!response) {
                setError("Failed to load preview data.");
                setLoading(false);
                return;
            }

            setData(response.data || []);
            setYKeys(Array.isArray(response.yKeys) && response.yKeys.length > 0
                ? response.yKeys
                : (Array.isArray(config.dependentVariables) ? config.dependentVariables : []));
            setAvailableYears(response.availableYears || null);
            setSelectedYear(response.appliedFilter?.year ?? null);
            setLoading(false);
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);

    const refetchForYear = async (year) => {
        if (!dataSourceId || !config) return;
        const requestId = ++requestRef.current;
        setLoading(true);
        setError(null);
        const response = await metricDataService.previewMetricData(dataSourceId, config, {
            year,
            aggregatePeriod: toBackendAggregatePeriod(aggregationPeriod),
        });
        if (requestRef.current !== requestId) return;

        if (!response) {
            setError("Failed to load preview data.");
            setLoading(false);
            return;
        }

        setData(response.data || []);
        setYKeys(Array.isArray(response.yKeys) && response.yKeys.length > 0
            ? response.yKeys
            : (Array.isArray(config.dependentVariables) ? config.dependentVariables : []));
        if (response.availableYears) setAvailableYears(response.availableYears);
        setSelectedYear(response.appliedFilter?.year ?? year);
        setLoading(false);
    };

    return { data, yKeys, availableYears, selectedYear, loading, error, refetchForYear };
}
