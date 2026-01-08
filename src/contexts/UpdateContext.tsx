/**
 * UpdateContext - Provides PWA update state across the app
 * 
 * Uses version checking against Convex backend instead of service worker.
 * Checks on visibility changes with 15-minute cooldown.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

interface UpdateContextType {
  needRefresh: boolean;
  isChecking: boolean;
  applyUpdate: () => void;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const versionState = useVersionCheck();

  return (
    <UpdateContext.Provider value={versionState}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdate must be used within UpdateProvider');
  }
  return context;
}
