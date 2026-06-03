// App-level context providing workspace state and action stubs.
// Mounted in the root layout; consumed by login-signup and the auth layout.
// Action stubs are intentional placeholders for future wiring.

import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext({});


export function AppProvider({ children }) {
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
