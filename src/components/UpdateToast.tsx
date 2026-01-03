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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 md:bottom-4 z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[200px]">
        {/* Checking state */}
        {isChecking && (
          <>
            <SpinnerIcon />
            <span className="text-sm text-slate-300">Checking for updates...</span>
          </>
        )}

        {/* Update available */}
        {!isChecking && needRefresh && (
          <>
            <UpdateIcon />
            <span className="text-sm text-slate-300">Update available</span>
            <button
              onClick={applyUpdate}
              className="ml-2 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors font-medium"
            >
              Update now
            </button>
          </>
        )}

        {/* Up to date confirmation */}
        {!isChecking && !needRefresh && lastCheckResult === 'up-to-date' && (
          <>
            <CheckIcon />
            <span className="text-sm text-green-400">App is up to date</span>
          </>
        )}
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-400 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function UpdateIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-green-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}
