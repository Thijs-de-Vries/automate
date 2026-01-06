/**
 * UpdateToast - Shows update notifications for the PWA
 * 
 * Displays:
 * - "Update available" with update button when new version is ready
 * - "App is up to date" confirmation after manual check
 * - "Checking..." while checking for updates
 * 
 * Positioned: bottom-center on mobile, bottom-right on desktop
 */

import { useEffect } from 'react';
import { useUpdate } from '../contexts/UpdateContext';
import { RefreshCw, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UpdateToast() {
  const { needRefresh, isChecking, lastCheckResult, applyUpdate, clearCheckResult } = useUpdate();

  // Auto-dismiss "up-to-date" message after 3 seconds
  useEffect(() => {
    if (lastCheckResult === 'up-to-date') {
      const timer = setTimeout(() => {
        clearCheckResult();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastCheckResult, clearCheckResult]);

  // Don't show anything if no state to display
  if (!needRefresh && !isChecking && lastCheckResult === 'none') {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 md:bottom-4 z-50">
      <div className={cn(
        'bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/50',
        'px-4 py-3 flex items-center gap-3 min-w-[200px] backdrop-blur-xl'
      )}>
        {/* Checking state */}
        {isChecking && (
          <>
            <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
            <span className="text-sm text-[var(--muted-foreground)]">Checking for updates...</span>
          </>
        )}

        {/* Update available */}
        {!isChecking && needRefresh && (
          <>
            <RefreshCw className="w-5 h-5 text-[var(--primary)]" />
            <span className="text-sm text-[var(--muted-foreground)]">Update available</span>
            <button
              onClick={applyUpdate}
              className={cn(
                'ml-2 px-3 py-1.5 text-sm rounded-lg font-medium transition-all duration-200',
                'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white',
                'shadow-lg shadow-[var(--primary-glow)]'
              )}
            >
              Update now
            </button>
          </>
        )}

        {/* Up to date confirmation */}
        {!isChecking && !needRefresh && lastCheckResult === 'up-to-date' && (
          <>
            <Check className="w-5 h-5 text-[var(--success)]" />
            <span className="text-sm text-[var(--success)]">App is up to date</span>
          </>
        )}
      </div>
    </div>
  );
}
