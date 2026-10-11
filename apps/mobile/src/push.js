import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { api } from './api';

// Show an alert even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let currentToken = null;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#007bff',
  });
}

/**
 * Ask for permission, get this device's Expo push token, and register it with
 * the backend. Call after sign-in. No-op on web, on a simulator, or if the user
 * declines. Safe to call repeatedly.
 */
export async function registerForPush() {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token || token === currentToken) { currentToken = token || currentToken; return; }

    await api.post('/notifications/push/register', { token, platform: Platform.OS });
    currentToken = token;
  } catch (error) {
    // Push is a nice-to-have; a failure here never blocks the app.
    console.warn('[push] register failed:', error?.message);
  }
}

/** Remove this device's token from the account (call on logout). */
export async function unregisterPush() {
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try {
    await api.post('/notifications/push/unregister', { token });
  } catch {
    // The token is already cleared locally; the server prunes dead tokens on send.
  }
}

// Where each notification type should land when the user taps it.
const TAB_FOR_TYPE = {
  PAYMENT_RECEIVED: 'Wallet',
  REQUEST_APPROVED: 'Bookings',
  REQUEST_REJECTED: 'Bookings',
  JOIN_REQUEST: 'Trips',
  TRIP_UPDATE: 'Trips',
  CHAT_MESSAGE: 'Trips',
  EXPENSE_ADDED: 'Trips',
};

/**
 * Wire tap handling: when the user taps a notification, open the right tab.
 * Returns an unsubscribe function. `onOpen(tab)` is called with the target tab.
 */
export function addNotificationResponseListener(onOpen) {
  const handle = (response) => {
    const type = response?.notification?.request?.content?.data?.type;
    const tab = TAB_FOR_TYPE[type];
    if (tab) onOpen(tab);
  };
  // A tap that cold-started the app.
  Notifications.getLastNotificationResponseAsync().then((response) => { if (response) handle(response); });
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
