import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import DataSourceService from "../services/DataSourceService";
import apiClient from "../utils/api/apiClient";
import useDataSourceSubscription from '../hooks/modules/day_book/data-sources/useDataSourceSubscription';

const DataSourceContext = createContext({});

// fields that the backend explicitly clears (sets to null in the broadcast
// payload). Keys present in the subscription event with `null` should remove
// the field from the local copy rather than be filtered out - otherwise stale
// values like `progressStage` / `progressPercent` / `error` linger forever.
const CLEARABLE_FIELDS = new Set([
    "error",
    "progressStage",
    "progressPercent",
    "errorType",
]);

// status values that mean processing has finished and the data source has
// reached a stable state. these trigger a debounced background refetch so
// fields that aren't in the subscription payload (`requiresReview`,
// `errorType`, `enabled`) get pulled in - without this, a row that finishes
// in `active` keeps the stale `requiresReview: true` from a prior
// auto-inferred schema and stays stuck in the Schema Review bucket.
const TERMINAL_STATUSES = new Set(["active", "error", "failed", "no_data"]);

export function DataSourceProvider({ children }) {
    // instantiate real service once for the app
    const serviceRef = React.useRef(null);
    if (!serviceRef.current) {
        serviceRef.current = new DataSourceService(apiClient);
    }

    // local data source state
    const [dataSources, setDataSources] = useState({
        list: [],
        count: 0,
        connected: [],
        errors: [],
        updateTrigger: 0,
    });
    const [system, setSystem] = useState({
        isLoading: false,
        hasError: false,
        error: null,
    });

    const recomputeDataSources = useCallback((list) => {
        const connected = Array.isArray(list) ? list.filter(s => s?.status === 'connected') : [];
        const errors = Array.isArray(list) ? list.filter(s => s?.status === 'error') : [];
        return {
            list: Array.isArray(list) ? list : [],
            count: Array.isArray(list) ? list.length : 0,
            connected,
            errors,
        };
    }, []);

    const refreshDataSources = useCallback(async () => {
        setSystem(prev => ({ ...prev, isLoading: true, hasError: false, error: null }));
        try {
            const list = await serviceRef.current.getConnectedDataSources();
            const stats = recomputeDataSources(list);
            setDataSources(prev => ({
                ...prev,
                ...stats,
                updateTrigger: prev.updateTrigger + 1,
            }));
            setSystem(prev => ({ ...prev, isLoading: false, hasError: false, error: null }));
            console.log('[DataSourceContext] refreshDataSources success', { count: stats.count });
        } catch (e) {
            // Treat permission denials as an empty list rather than a fatal
            // error. Users with metric-only access legitimately can't list
            // data sources, but the rest of the app (metric viewing) still
            // works — surface this as a non-error empty state.
            const msg = e?.message || '';
            if (/permission/i.test(msg)) {
                console.log('[DataSourceContext] refreshDataSources skipped (no permission)');
                const stats = recomputeDataSources([]);
                setDataSources(prev => ({
                    ...prev,
                    ...stats,
                    updateTrigger: prev.updateTrigger + 1,
                }));
                setSystem(prev => ({ ...prev, isLoading: false, hasError: false, error: null }));
                return;
            }
            console.error('[DataSourceContext] refreshDataSources error', { message: e?.message });
            setSystem(prev => ({ ...prev, isLoading: false, hasError: true, error: e?.message || 'Failed to load data sources' }));
        }
    }, [recomputeDataSources]);

    // real-time data source updates via subscription
    // when a terminal status arrives we schedule a debounced refetch so any
    // fields outside the subscription payload (requiresReview, errorType,
    // enabled) catch up to the backend without needing a manual refresh.
    const terminalRefetchTimerRef = useRef(null);
    useEffect(() => () => {
        if (terminalRefetchTimerRef.current) {
            clearTimeout(terminalRefetchTimerRef.current);
            terminalRefetchTimerRef.current = null;
        }
    }, []);
    const scheduleTerminalRefetch = useCallback(() => {
        if (terminalRefetchTimerRef.current) return;
        terminalRefetchTimerRef.current = setTimeout(() => {
            terminalRefetchTimerRef.current = null;
            refreshDataSources();
        }, 400);
    }, [refreshDataSources]);

    useDataSourceSubscription((updatedDataSource) => {
        // partition the payload into present values vs explicit clears. Most
        // keys with `null` are just unused (the broadcast mutation sends every
        // possible field); but the handful of fields the backend actively
        // clears need to take effect locally.
        const updates = {};
        const clears = [];
        for (const [k, v] of Object.entries(updatedDataSource || {})) {
            if (v == null) {
                if (CLEARABLE_FIELDS.has(k)) clears.push(k);
            } else {
                updates[k] = v;
            }
        }

        // AppSync delivers `config` as an AWSJSON string. The rest of the app
        // (filters keyed on config.parentDataSourceId, status chips, etc.)
        // expects an object. Parse it back before merging, otherwise rows
        // hydrated via subscription drop out of the dashboard child filter
        // (most visibly during long-lived progress stages like "Finalising").
        if (typeof updates.config === "string") {
            try {
                updates.config = JSON.parse(updates.config);
            } catch (err) {
                console.warn("[DataSourceContext] failed to parse subscription config:", err?.message);
                // leave the old config in place rather than clobbering with a string
                delete updates.config;
            }
        }

        // DELETE event: drop the data source from local state
        if (updates.action === "DELETE") {
            setDataSources(prev => {
                const list = prev.list.filter(ds => ds.dataSourceId !== updates.dataSourceId);
                return {
                    ...prev,
                    ...recomputeDataSources(list),
                    updateTrigger: prev.updateTrigger + 1,
                };
            });
            console.log("[DataSourceContext] Real-time data source deleted:", updates.dataSourceId);
            return;
        }

        setDataSources(prev => {
            const exists = prev.list.some(ds => ds.dataSourceId === updates.dataSourceId);
            const newList = prev.list.map(ds => {
                if (ds.dataSourceId !== updates.dataSourceId) return ds;
                const merged = { ...ds, ...updates };
                for (const key of clears) delete merged[key];
                return merged;
            });
            const list = exists ? newList : [...prev.list, updates];
            return {
                ...prev,
                ...recomputeDataSources(list),
                updateTrigger: prev.updateTrigger + 1,
            };
        });

        // refetch on terminal transitions so flags that aren't part of the
        // subscription payload (requiresReview, errorType, enabled) update.
        const incomingStatus = (updates.status || "").toLowerCase();
        if (incomingStatus && TERMINAL_STATUSES.has(incomingStatus)) {
            scheduleTerminalRefetch();
        }

        console.log("[DataSourceContext] Real-time data source update:", updates);
    }, () => {
        // on subscription reconnect, refetch the data source list to catch
        // up on anything missed while disconnected.
        refreshDataSources();
    });

    const connectDataSource = useCallback(async (type, config, name) => {
        const created = await serviceRef.current.connectDataSource(type, config, name);
        try { await refreshDataSources(); } catch {}
        return created;
    }, [refreshDataSources]);

    const disconnectDataSource = useCallback(async (sourceId) => {
        const ok = await serviceRef.current.disconnectDataSource(sourceId);
        try { await refreshDataSources(); } catch {}
        return ok;
    }, [refreshDataSources]);

    const testConnection = useCallback(async (type, config, name) => {
        const result = await serviceRef.current.testConnection(type, config, name);
        return result;
    }, []);

    const refreshDashboardRawData = useCallback(async (sourceId) => {
        const result = await serviceRef.current.refreshDashboardRawData(sourceId);
        try { await refreshDataSources(); } catch {}
        return result;
    }, [refreshDataSources]);

    const rescanMicromaxDashboard = useCallback(async (parentSourceId, sourceType) => {
        const result = await serviceRef.current.rescanMicromaxDashboard(parentSourceId, sourceType);
        try { await refreshDataSources(); } catch {}
        return result;
    }, [refreshDataSources]);

    const toggleDataSourceEnabled = useCallback(async (sourceId, enabled) => {
        const result = await serviceRef.current.toggleDataSourceEnabled(sourceId, enabled);
        try { await refreshDataSources(); } catch {}
        return result;
    }, [refreshDataSources]);

    return (
        <DataSourceContext.Provider value={{
            dataSources,
            system,
            connectDataSource,
            disconnectDataSource,
            testConnection,
            refreshDataSources,
            refreshDashboardRawData,
            rescanMicromaxDashboard,
            toggleDataSourceEnabled,
            forceUpdate: () => setDataSources(prev => ({ ...prev, updateTrigger: prev.updateTrigger + 1 })),
        }}>
            {children}
        </DataSourceContext.Provider>
    );
}

export function useDataSourceContext() {
    return useContext(DataSourceContext);
}

export default DataSourceContext;
