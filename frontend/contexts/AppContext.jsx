import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext({});


export function AppProvider({ children }) {
    // app level state
    const [workspaceId, setWorkspaceId] = useState(null);

    return (
        <AppContext.Provider value={{
            workspaceId,
            setWorkspaceId,
            actions: {
                login: () => {},
                logout: () => {},
                switchAccount: () => {},
                connectProvider: () => {},
                disconnectProvider: () => {},
                isProviderConnected: () => false,
                refreshAll: () => {},
                refreshAccounts: () => {},
                linkCurrentUser: () => {},
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
