import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Only the refresh token is stored (Android Keystore-backed), so a restart
// signs the person back in. The short-lived access token stays in memory.
const KEY = 'pickandsync.refreshToken';
const supported = Platform.OS !== 'web';

export async function saveRefreshToken(token) {
  if (!supported) return;
  try {
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Storage failures only mean the next launch asks for a sign-in again.
  }
}

export async function loadRefreshToken() {
  if (!supported) return null;
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}
