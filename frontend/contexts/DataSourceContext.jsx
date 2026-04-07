import React, { createContext, useContext, useState, useCallback } from 'react';
import DataSourceService from "../services/DataSourceService";
import apiClient from "../utils/api/apiClient";
import useDataSourceSubscription from '../hooks/modules/day_book/data-sources/useDataSourceSubscription';

const DataSourceContext = createContext({});

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
            console.error('[DataSourceContext] refreshDataSources error', { message: e?.message });
            setSystem(prev => ({ ...prev, isLoading: false, hasError: true, error: e?.message || 'Failed to load data sources' }));
        }
    }, [recomputeDataSources]);

    // real-time data source updates via subscription
    useDataSourceSubscription((updatedDataSource) => {
        const cleaned = Object.fromEntries(
            Object.entries(updatedDataSource).filter(([_, v]) => v != null)
        );
        setDataSources(prev => {
            const newList = prev.list.map(ds =>
                ds.dataSourceId === cleaned.dataSourceId
                    ? { ...ds, ...cleaned }
                    : ds
            );
            const exists = prev.list.some(ds => ds.dataSourceId === cleaned.dataSourceId);
            const list = exists ? newList : [...prev.list, cleaned];
            return {
                ...prev,
                ...recomputeDataSources(list),
                updateTrigger: prev.updateTrigger + 1,
            };
        });
        console.log("[DataSourceContext] Real-time data source update:", cleaned);
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

    return (
        <DataSourceContext.Provider value={{
            dataSources,
            system,
            connectDataSource,
            disconnectDataSource,
            testConnection,
            refreshDataSources,
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
