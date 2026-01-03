/**
 * UpdateContext - Provides PWA update state across the app
 * 
 * Shares the service worker update state between components
 * (UserButton menu and UpdateToast).
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useServiceWorker } from '../hooks/useServiceWorker';

interface UpdateContextType {
  needRefresh: boolean;
  isChecking: boolean;
  lastCheckResult: 'none' | 'up-to-date' | 'update-available';
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => void;
  clearCheckResult: () => void;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const swState = useServiceWorker();

  return (
    <UpdateContext.Provider value={swState}>
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
