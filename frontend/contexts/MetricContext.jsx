import metricService from "../services/MetricService";
import { useRef, useCallback, useMemo, createContext, useContext, useState, useEffect } from "react";
import useMetricSubscription from "../hooks/modules/day_book/metrics/useMetricSubscription";
import useDataUpdateSubscription from "../hooks/modules/day_book/data-sources/useDataUpdateSubscription";
import { getCurrentUser } from "aws-amplify/auth";
import { apiGet } from "../utils/api/apiClient";
import endpoints from "../utils/api/endpoints";

const MetricContext = createContext(null);

export function MetricProvider({ children, workspaceId: workspaceIdProp }) {
    // use the singleton metric service instance via useRef
    const serviceRef = useRef(metricService);
    const hasFetchedRef = useRef(false);

    const workspaceId = workspaceIdProp || null;

    // store metrics[], loading, error, in state
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [metricTypeFilter, setMetricTypeFilter] = useState(null);
    // bumped per-dataSourceId when an onDataUpdate event arrives so that downstream graph caches
    // can invalidate the cached chart data for metrics that use that data source
    const [dataUpdateVals, setDataUpdateVals] = useState({});

    // current user identity — used to filter metrics by access
    const [currentUserId, setCurrentUserId] = useState(null);
    const [userRoleId, setUserRoleId] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const { userId } = await getCurrentUser();
                setCurrentUserId(userId);
            } catch {}
        })();
    }, []);

    useEffect(() => {
        if (!workspaceId) return;
        (async () => {
            try {
                const result = await apiGet(endpoints.workspace.roles.getRoleOfUser(workspaceId));
                setUserRoleId(result?.data?.roleId ?? null);
            } catch {}
        })();
    }, [workspaceId]);

    const loadMetrics = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);
            const result = await serviceRef.current.getMetrics();
            setMetrics(result.data ?? result ?? []);
            console.log("[MetricContext] Metrics loaded successfully:", result.data?.length ?? 0, "metrics");
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

    // the hook provides a single onUpdate callback for all metric changes
    useMetricSubscription((updatedMetric) => {
        const cleaned = Object.fromEntries(
            Object.entries(updatedMetric).filter(([_, v]) => v != null)
        );

        // handle deletion (mirrors Boards pattern)
        if (cleaned.action === "DELETE") {
            setMetrics(prev => prev.filter(m => m.metricId !== cleaned.metricId));
            console.log("[MetricContext] Real-time metric deleted:", cleaned.metricId);
            return;
        }

        // AppSync AWSJSON fields arrive as JSON strings
        // parse them so downstream consumers can read object properties
        for (const field of ["config", "calculation"]) {
            if (typeof cleaned[field] === "string") {
                try {
                    cleaned[field] = JSON.parse(cleaned[field]);
                } catch (err) {
                    console.warn(`[MetricContext] Failed to parse ${field} from subscription payload:`, err);
                }
            }
        }
        setMetrics(prev => {
            const exists = prev.find(m => m.metricId === cleaned.metricId);
            if (exists) {
                return prev.map(m => m.metricId === cleaned.metricId ? { ...m, ...cleaned } : m);
            } else {
                return [...prev, cleaned];
            }
        });
        console.log("[MetricContext] Real-time metric update: ", cleaned);
    }, workspaceId, () => {
        // on subscription reconnect (network blip, foreground), refetch
        // the metric list so we catch anything that happened while we
        // were disconnected.
        loadMetrics(false);
    });

    useDataUpdateSubscription((dataUpdate) => {
        // bump Val so cached chart data for metrics on this data source is invalidated and refetched on next render
        if (dataUpdate?.dataSourceId) {
            setDataUpdateVals(prev => ({
                ...prev,
                [dataUpdate.dataSourceId]: (prev[dataUpdate.dataSourceId] ?? 0) + 1,
            }));
        }
        // trigger silent refresh to pick up new metric data
        loadMetrics(false);
        console.log("[MetricContext] Data update for data source:", dataUpdate.dataSourceId, "affecting metrics:", dataUpdate.metrics);
    }, workspaceId, () => {
        loadMetrics(false);
    });

    // filter metrics by type
    const filteredMetrics = useMemo(() => {
        if (!metricTypeFilter) return metrics;
        return metrics.filter(m => m.type === metricTypeFilter);
    }, [metrics, metricTypeFilter]);

    // filter metrics by access — only show metrics the current user can see
    const accessibleMetrics = useMemo(() => {
        if (!currentUserId) return metrics;
        return metrics.filter(m => {
            const access = m.access;
            if (!access || !access.accessType || access.accessType === 'workspace') return true;
            if (String(m.createdBy) === String(currentUserId)) return true;
            const collaborators = Array.isArray(access.collaborators) ? access.collaborators : [];
            if (collaborators.some(c => String(c.userId) === String(currentUserId))) return true;
            const roleAccess = Array.isArray(access.roleAccess) ? access.roleAccess : [];
            if (userRoleId && roleAccess.some(r => String(r.roleId) === String(userRoleId))) return true;
            return false;
        });
    }, [metrics, currentUserId, userRoleId]);

    // helper to get metrics by type
    const getMetricsByType = useCallback((type) => {
        return metrics.filter(m => m.type === type);
    }, [metrics]);

    // provide context value
    const value = useMemo(() => ({
        // states
        metrics,
        filteredMetrics,
        accessibleMetrics,
        loading,
        error,
        ensureMetrics,
        metricTypeFilter,
        dataUpdateVals,

        // actions
        createMetric,
        deleteMetric,
        updateMetric,
        getMetricData,
        getMetric,
        getMetricsByType,
        setMetricTypeFilter,
        refresh: () => loadMetrics(true),
    }), [metrics, filteredMetrics, accessibleMetrics, loading, error, ensureMetrics, metricTypeFilter, dataUpdateVals, createMetric, deleteMetric, updateMetric, getMetricData, getMetric, getMetricsByType, loadMetrics]);

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