import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import DataSourceService from "../services/DataSourceService";
import apiClient from "../utils/api/apiClient";
import useDataSourceSubscription from '../hooks/modules/day_book/data-sources/useDataSourceSubscription';

const AppContext = createContext({});


export function AppProvider({ children }) {
    // Instantiate the real service once for the app
    const serviceRef = React.useRef(null);
    if (!serviceRef.current) {
        serviceRef.current = new DataSourceService(apiClient);
    }

    // Local app state
    const [dataSources, setDataSources] = useState({
        list: [],
        count: 0,
        connected: [],
        errors: [],
        isDemoMode: false,
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
            console.log('[AppContext] refreshDataSources -> calling service.getConnectedDataSources');
        const list = await serviceRef.current.getConnectedDataSources();
            const stats = recomputeDataSources(list);
            setDataSources(prev => ({
                ...prev,
                ...stats,
                updateTrigger: prev.updateTrigger + 1,
            }));
            setSystem(prev => ({ ...prev, isLoading: false, hasError: false, error: null }));
            console.log('[AppContext] refreshDataSources success', { count: stats.count });
        } catch (e) {
            console.error('[AppContext] refreshDataSources error', { message: e?.message });
            setSystem(prev => ({ ...prev, isLoading: false, hasError: true, error: e?.message || 'Failed to load data sources' }));
        }
    }, [recomputeDataSources]);

    // Eager load once at app start (deduped in service if called again elsewhere)
    /*useEffect(() => {
        refreshDataSources();
    }, [refreshDataSources]);*/

    // real time data source updates
    useDataSourceSubscription((updatedDataSource) => {
        setDataSources(prev => {
            const newList = prev.list.map(ds =>
                ds.dataSourceId === updatedDataSource.dataSourceId
                    ? { ...ds, ...updatedDataSource }
                    : ds
            );
            const exists = prev.list.some(ds => ds.dataSourceId === updatedDataSource.dataSourceId);
            const list = exists ? newList : [...prev.list, updatedDataSource];
            return {
                ...prev,
                ...recomputeDataSources(list),
                updateTrigger: prev.updateTrigger + 1,
            };
        });
        console.log("[AppContext] Real-time data source update:", updatedDataSource);
    });

    return (
        <AppContext.Provider value={{
            dataSources,
            system,
            actions: {
                login: () => {},
                logout: () => {},
                switchAccount: () => {},
                connectDataSource: async (type, config, name) => {
                    console.log('[AppContext] connectDataSource called', { type, config, name });
                    const created = await serviceRef.current.connectDataSource(type, config, name);
                    console.log('[AppContext] connectDataSource result', created);
                    try { await refreshDataSources(); } catch {}
                    return created;
                },
                disconnectDataSource: async (sourceId) => {
                    const ok = await serviceRef.current.disconnectDataSource(sourceId);
                    try { await refreshDataSources(); } catch {}
                    return ok;
                },
                testConnection: async (type, config, name) => {
                    console.log('[AppContext] testConnection called', { type, config, name });
                    const result = await serviceRef.current.testConnection(type, config, name);
                    console.log('[AppContext] testConnection success', { type, name, result: { status: result?.status } });
                    return result;
                },
                connectProvider: () => {},
                disconnectProvider: () => {},
                isProviderConnected: () => false,
                refreshAll: () => {},
                refreshAccounts: () => {},
                refreshDataSources,
                getAppState: () => ({ dataSources, system }),
                debugAppState: () => { console.log('[AppContext] state snapshot', { dataSourcesCount: dataSources.count, loading: system.isLoading, hasError: system.hasError }); },
                linkCurrentUser: () => {},
                forceUpdate: () => setDataSources(prev => ({ ...prev, updateTrigger: prev.updateTrigger + 1 })),
            }
        }}>
            {children}
        </AppContext.Provider>
    );
}


export function useAppContext() {
    return useContext(AppContext);
}

// Alias for compatibility with existing imports
export const useApp = useAppContext;
