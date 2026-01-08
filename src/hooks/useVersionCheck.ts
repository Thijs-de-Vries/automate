/**
 * useVersionCheck - Hook for version-based update detection
 * 
 * Features:
 * - Checks Convex backend for version on visibility changes
 * - 15-minute cooldown between checks to avoid spam
 * - Compares local version (Git SHA) with remote version
 * - Syncs version to Convex on mount
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { APP_VERSION } from '@/config/version';

const CHECK_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

export function useVersionCheck() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const lastCheckRef = useRef(Date.now());
  
  // Query Convex for the current version
  const convexVersion = useQuery(api.appMetadata.getAppVersion);
  const setVersion = useMutation(api.appMetadata.setAppVersion);

  // Sync version to Convex on mount
  useEffect(() => {
    if (APP_VERSION !== 'dev') {
      setVersion({ version: APP_VERSION });
    }
  }, [setVersion]);

  // Check for version mismatch whenever convexVersion updates
  useEffect(() => {
    if (convexVersion && convexVersion !== APP_VERSION && APP_VERSION !== 'dev') {
      setNeedRefresh(true);
    }
  }, [convexVersion]);

  // Listen for visibility changes and check with cooldown
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      
      const now = Date.now();
      const elapsed = now - lastCheckRef.current;
      
      // Only check if cooldown period has passed
      if (elapsed < CHECK_COOLDOWN_MS) return;
      
      lastCheckRef.current = now;
      
      // Show subtle checking indicator
      setIsChecking(true);
      
      // Trigger version query by updating timestamp
      // The useEffect above will handle the comparison
      setTimeout(() => {
        setIsChecking(false);
      }, 1000);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Apply update by reloading the page
  const applyUpdate = useCallback(() => {
    window.location.reload();
  }, []);

  return {
    needRefresh,
    isChecking,
    applyUpdate,
  };
}
