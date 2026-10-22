import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';
import { createClient } from './client';
const KEY = 'pickandsync.host.refreshToken';
let ended = () => {};
export const setSessionEndHandler = (handler) => { ended = handler; };
export const api = createClient({
  baseUrl: API_URL,
  // Web preview is memory-only. Native refresh credentials use encrypted device storage.
  storage: {
    load: () => Platform.OS === 'web' ? null : SecureStore.getItemAsync(KEY),
    save: (token) => Platform.OS === 'web' ? Promise.resolve() : token ? SecureStore.setItemAsync(KEY, token) : SecureStore.deleteItemAsync(KEY),
  },
  onSessionEnd: () => ended(),
});
