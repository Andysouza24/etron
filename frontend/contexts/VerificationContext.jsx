// Thin placeholder context for password-verification state.
// Mounted in the root layout; consumed by account-settings and the auth layout.

import React, { createContext, useContext } from 'react';

const VerificationContext = createContext({});

export function VerificationProvider({ children }) {
  return <VerificationContext.Provider value={{}}>{children}</VerificationContext.Provider>;
}


export function useVerificationContext() {
  return useContext(VerificationContext);
}

// Alias for compatibility with existing imports
export const useVerification = useVerificationContext;
