import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// A light tick on taps and a buzz on results; silently skipped where unsupported.
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

export function tapFeedback() {
  if (supported) Haptics.selectionAsync().catch(() => {});
}

export function successFeedback() {
  if (supported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function errorFeedback() {
  if (supported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
