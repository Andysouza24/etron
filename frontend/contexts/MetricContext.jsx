import metricService from "../services/MetricService";
import { useRef, useCallback, useMemo, createContext, useContext, useState } from "react";
// import useMetricSubscription from "../hooks/modules/day_book/useMetricSubscription";

const MetricContext = createContext(null);

export function MetricProvider({ children }) {
    // use the singleton metric service instance via useRef
    const serviceRef = useRef(metricService);
    const hasFetchedRef = useRef(false);

    // store metrics[], loading, error, in state
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadMetrics = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);
            const result = await serviceRef.current.getMetrics();
            setMetrics(result.data ?? result ?? []);
            console.log("[MetricContext] Metrics loaded successfully: ", result);
        } catch (err) {
            console.error("[MetricContext] Error loading metrics: ", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const ensureMetrics = useCallback(async () => {
        if (!hasFetchedRef.current) {
            await loadMetrics();
        }
    }, [loadMetrics]);
    
    /*// load on mount
    useEffect(() => {
        loadMetrics();
    }, [loadMetrics]);*/

    // expose refresh metrics
    // create metric
    const createMetric = useCallback(async (payload) => {
        try {
            setError(null);
            const result = await serviceRef.current.createMetric(payload);
            await loadMetrics(false); // silent refresh
            console.log("[MetricContext] Metric created successfully: ", result);
            return result;
        } catch (err) {
            console.error("[MetricContext] Error creating metric: ", err);
            setError(err);
            throw err;
        }
    }, [loadMetrics]);

    // delete metric
    const deleteMetric = useCallback(async (metricId) => {
        try {
            setError(null);
            await serviceRef.current.deleteMetric(metricId);
            // update UI before server confirmation
            setMetrics(prev => prev.filter(m => m.id !== metricId));
            console.log("[MetricContext] Metric deleted successfully: ", metricId);
        } catch (err) {
            console.error("[MetricContext] Error deleting metric: ", err);
            setError(err);
            await loadMetrics(false); // rollback when error occurs
            throw err;
        }
    }, [loadMetrics]);

    // update metric
    const updateMetric = useCallback(async (metricId, payload) => {
        try {
            setError(null);
            const result = await serviceRef.current.updateMetric(metricId, payload);
            // update UI before server confirmation
            setMetrics(prev => prev.map(m => m.id === metricId ? { ...m, ...payload} : m));
            console.log("[MetricContext] Metric updated successfully: ", result);
            return result;
        } catch (err) {
            console.error("[MetricContext] Error updating metric: ", err);
            setError(err);
            await loadMetrics(false); // rollback when error occurs
            throw err;
        }
    }, [loadMetrics]);

    // get metric data
    const getMetricData = useCallback(async (dataSourceId, metricId) => {
        return serviceRef.current.getMetricData(dataSourceId, metricId);
    }, []);

    // get metric
    const getMetric = useCallback(async (metricId) => {
        return serviceRef.current.getMetric(metricId);
    }, []);

    // TODO: wire up useMetricSubscription to auto-update list on real-time events
    // the hook provides a single onUpdate callback for all metric changes
    /*useMetricSubscription((updatedMetric) => {
        setMetrics(prev => {
            const exists = prev.find(m => m.metricId === updatedMetric.metricId);
            if (exists) {
                // update existing metric
                return prev.map(m => m.metricId === updatedMetric.metricId ? { ...m, ...updatedMetric } : m);
            } else {
                // new metric — append
                return [...prev, updatedMetric];
            }
        });
        console.log("[MetricContext] Real-time metric update: ", updatedMetric);
    });*/

    // provide context value
    const value = useMemo(() => ({
        // states
        metrics,
        loading,
        error,
        ensureMetrics,

        // actions
        createMetric,
        deleteMetric,
        updateMetric,
        getMetricData,
        getMetric,
        refresh: () => loadMetrics(true),
    }), [metrics, loading, error, ensureMetrics, createMetric, deleteMetric, updateMetric, getMetricData, getMetric, loadMetrics]);

    return (
        <MetricContext.Provider value={value}>
            {children}
        </MetricContext.Provider>
    );
}

export function useMetricContext() {
    const context = useContext(MetricContext);
    if (!context) {
        throw new Error("useMetricContext must be used within a MetricProvider");
    }
    return context;
}

export default MetricContext;