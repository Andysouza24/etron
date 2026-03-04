import { useCallback, useEffect, useState } from 'react';
import metricService from '../../../../services/MetricService';

export default function useMetric() {
    // manage local state
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // expose bound actions 
    const loadMetrics = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);
            const result = await metricService.getMetrics();
            setMetrics(result.data ?? result ?? []);
            console.log("[useMetric] Metrics loaded successfully: ", result);
        } catch (err) {
            console.error("[useMetric] Error loading metrics: ", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);


    const createMetric = useCallback(async (payload) => {
        try {
            setError(null);
            const result = await metricService.createMetric(payload);
            await loadMetrics(false); // refresh metrics list after creating
            console.log("[useMetric] Metric created successfully: ", result);
            return result;
        } catch (err) {
            console.error("[useMetric] Error creating metric: ", err);
            setError(err);
            throw err;
        }
    }, [loadMetrics]);

    const deleteMetric = useCallback(async (metricId) => {
        try {
            setError(null);
            const result = await metricService.deleteMetric(metricId);
            await loadMetrics(false); // refresh metrics list after deleting
            console.log("[useMetric] Metric deleted successfully: ", result);
            return result;

        } catch (err) {
            console.error("[useMetric] Error deleting metric: ", err);
            setError(err);
            throw err;
        }
    }, [loadMetrics]);

    // get metric
    // get metric data
    const getMetricData = useCallback(async (dataSourceId, metricId) => {
        try {
            setError(null);
            return await metricService.getMetricData(dataSourceId, metricId);
        } catch (err) {
            console.error("[useMetric] Error fetching metric data: ", err);
            setError(err);
            throw err;
        }

    }, []);

    // TODO: handle loading and error states

    // refresh after mutations
    useEffect(() => {
        loadMetrics();
    }, [loadMetrics]);

    return {
        metrics,
        loading,
        error,
        loadMetrics,
        createMetric,
        deleteMetric,
        getMetric: metricService.getMetric.bind(metricService),
        getMetricData,
        refresh: () => loadMetrics(true),
    };

}