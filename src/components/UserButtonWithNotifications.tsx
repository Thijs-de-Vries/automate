/**
 * UserButtonWithNotifications - UserButton with push notification toggle
 * 
 * Wraps Clerk's UserButton and adds a custom action item for notifications.
 */

import { UserButton } from '@clerk/clerk-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useUpdate } from '../contexts/UpdateContext';

export function UserButtonWithNotifications() {
  const { isSupported, isSubscribed, isLoading, toggle, permission } = usePushNotifications();
  const { isChecking, checkForUpdates } = useUpdate();

  // Don't show notification option if not supported
  const showNotificationOption = isSupported;

  const handleNotificationToggle = async () => {
    await toggle();
  };

  // Determine label and icon based on state
  const getNotificationLabel = () => {
    if (isLoading) return 'Loading...';
    if (permission === 'denied') return 'Notifications blocked';
    if (isSubscribed) return 'Disable notifications';
    return 'Enable notifications';
  };

  return (
    <UserButton afterSignOutUrl="/">
      <UserButton.MenuItems>
        {showNotificationOption && (
          <UserButton.Action
            label={getNotificationLabel()}
            labelIcon={
              <NotificationIcon enabled={isSubscribed} denied={permission === 'denied'} />
            }
            onClick={handleNotificationToggle}
          />
        )}
        <UserButton.Action
          label={isChecking ? 'Checking...' : 'Check for updates'}
          labelIcon={<RefreshIcon />}
          onClick={checkForUpdates}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}

// Refresh icon for update button
function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      style={{ width: 16, height: 16 }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

// Simple bell icon component
function NotificationIcon({ enabled, denied }: { enabled: boolean; denied: boolean }) {
  if (denied) {
    // Bell with slash
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        style={{ width: 16, height: 16 }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.143 17.082a24.248 24.248 0 003.714 0m-7.035-3.61a3.75 3.75 0 011.178-2.693M3 3l18 18M15.536 8.464A5.248 5.248 0 0118 12.75v2.25m-7.5 3a2.25 2.25 0 01-4.5 0m11.356-8.356A5.248 5.248 0 0112 6.75 5.25 5.25 0 006.75 12v1.5"
        />
      </svg>
    );
  }

  if (enabled) {
    // Bell filled
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ width: 16, height: 16 }}
      >
        <path
          fillRule="evenodd"
          d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.244.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  // Bell outline
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      style={{ width: 16, height: 16 }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}
