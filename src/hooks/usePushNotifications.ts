/**
 * usePushNotifications - Hook for managing push notification subscriptions
 * 
 * Provides methods to subscribe/unsubscribe and check subscription status.
 */

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | 'unknown';
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'unknown',
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  // Convex queries and mutations
  const vapidPublicKey = useQuery(api.notifications.getVapidPublicKey);
  const subscriptionStatus = useQuery(api.notifications.getSubscriptionStatus);
  const saveSubscription = useMutation(api.notifications.saveSubscription);
  const removeSubscription = useMutation(api.notifications.removeSubscription);

  // Check browser support on mount
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const permission = 'Notification' in window ? Notification.permission : 'unknown';

    setState((prev) => ({
      ...prev,
      isSupported,
      permission: permission as NotificationPermission,
      isLoading: subscriptionStatus === undefined,
    }));
  }, [subscriptionStatus]);

  // Sync subscription status from Convex
  useEffect(() => {
    if (subscriptionStatus !== undefined) {
      setState((prev) => ({
        ...prev,
        isSubscribed: subscriptionStatus.isSubscribed,
        isLoading: false,
      }));
    }
  }, [subscriptionStatus]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((prev) => ({ ...prev, error: 'Push notifications not supported' }));
      return false;
    }

    if (!vapidPublicKey) {
      setState((prev) => ({ ...prev, error: 'VAPID key not configured on server' }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission !== 'granted') {
        setState((prev) => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Notification permission denied' 
        }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Convert VAPID public key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Extract keys
      const p256dh = arrayBufferToBase64(pushSubscription.getKey('p256dh')!);
      const auth = arrayBufferToBase64(pushSubscription.getKey('auth')!);

      // Save to Convex
      await saveSubscription({
        endpoint: pushSubscription.endpoint,
        p256dh,
        auth,
        userAgent: navigator.userAgent,
      });

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error('Failed to subscribe:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      }));
      return false;
    }
  }, [state.isSupported, vapidPublicKey, saveSubscription]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();
        
        // Remove from Convex
        await removeSubscription({ endpoint: subscription.endpoint });
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      }));
      return false;
    }
  }, [removeSubscription]);

  // Toggle subscription
  const toggle = useCallback(async (): Promise<boolean> => {
    if (state.isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [state.isSubscribed, subscribe, unsubscribe]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    toggle,
  };
}

// ============================================
// HELPERS
// ============================================

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
