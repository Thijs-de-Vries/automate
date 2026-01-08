/**
 * UpdateToast - Shows update notifications for the PWA
 * 
 * Displays:
 * - "Update available" with reload button when new version is detected
 * - "Checking..." while checking for updates (minimalist, non-distracting)
 * 
 * Positioned: bottom-center on mobile, bottom-right on desktop
 */

import { useUpdate } from '../contexts/UpdateContext';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UpdateToast() {
  const { needRefresh, isChecking, applyUpdate } = useUpdate();

  // Don't show anything if no state to display
  if (!needRefresh && !isChecking) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 md:bottom-4 z-50">
      <div className={cn(
        'bg-[var(--surface)]/95 border border-[var(--border)] rounded-xl shadow-2xl shadow-black/50',
        'px-4 py-2.5 flex items-center gap-3 backdrop-blur-xl',
        'transition-opacity duration-200',
        isChecking && 'opacity-60'
      )}>
        {/* Checking state - minimalist */}
        {isChecking && (
          <>
            <Loader2 className="w-4 h-4 text-[var(--muted-foreground)] animate-spin" />
            <span className="text-xs text-[var(--muted-foreground)]">Checking...</span>
          </>
        )}

        {/* Update available */}
        {!isChecking && needRefresh && (
          <>
            <RefreshCw className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-sm text-[var(--foreground)]">Update available</span>
            <button
              onClick={applyUpdate}
              className={cn(
                'ml-1 px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200',
                'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white'
              )}
            >
              Reload
            </button>
          </>
        )}
      </div>
    </div>
  );
}
