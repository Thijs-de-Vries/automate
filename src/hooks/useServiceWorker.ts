/**
 * useServiceWorker - Hook for managing PWA service worker updates
 * 
 * Features:
 * - Registers the service worker
 * - Checks for updates daily (once per 24h)
 * - Provides manual update check
 * - Exposes update state for UI
 */

/// <reference types="vite-plugin-pwa/client" />
import { useCallback, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const LAST_CHECK_KEY = 'pwa-last-update-check';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Store the updateSW function globally so it persists across hook instances
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let isRegistered = false;

export function useServiceWorker() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<'none' | 'up-to-date' | 'update-available'>('none');

  // Register the service worker on mount (only once globally)
  useEffect(() => {
    if (isRegistered) return;
    isRegistered = true;

    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
        setLastCheckResult('update-available');
      },
      onOfflineReady() {
        console.log('[SW] App ready for offline use');
      },
      onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
        console.log('[SW] Registered:', _swUrl);
        
        // Check if we need to do the daily update check
        const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
        const now = Date.now();
        
        if (!lastCheck || now - parseInt(lastCheck, 10) > CHECK_INTERVAL_MS) {
          // Perform daily update check
          console.log('[SW] Performing daily update check');
          localStorage.setItem(LAST_CHECK_KEY, now.toString());
          registration?.update();
        }
      },
      onRegisterError(error: Error) {
        console.error('[SW] Registration error:', error);
      },
    });
  }, []);

  // Check for updates manually
  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    if (!navigator.serviceWorker?.controller) {
      setLastCheckResult('up-to-date');
      return false;
    }

    setIsChecking(true);
    setLastCheckResult('none');

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        await registration.update();
        
        // Wait a bit to see if onNeedRefresh fires
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update timestamp
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
        
        // If needRefresh wasn't set by onNeedRefresh callback, we're up to date
        if (!needRefresh) {
          setLastCheckResult('up-to-date');
          return false;
        }
        
        setLastCheckResult('update-available');
        return true;
      }
      
      setLastCheckResult('up-to-date');
      return false;
    } catch (error) {
      console.error('[SW] Update check failed:', error);
      setLastCheckResult('up-to-date');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [needRefresh]);

  // Apply the update (reload the page with new SW)
  const applyUpdate = useCallback(() => {
    if (updateSW) {
      updateSW(true);
    }
  }, []);

  // Clear the "up-to-date" result after showing it
  const clearCheckResult = useCallback(() => {
    setLastCheckResult('none');
  }, []);

  return {
    needRefresh,
    isChecking,
    lastCheckResult,
    checkForUpdates,
    applyUpdate,
    clearCheckResult,
  };
}
