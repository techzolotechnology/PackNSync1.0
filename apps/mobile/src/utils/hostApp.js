import { Alert, Linking } from 'react-native';

const HOST_APP_URL = 'https://play.google.com/store/apps/details?id=com.pickandsync.host&pcampaignid=web_share';

export async function openHostApp() {
  try {
    await Linking.openURL(HOST_APP_URL);
  } catch {
    Alert.alert('Couldn’t open Google Play', 'Search for “PickAndSync Host: Rentals” in the Play Store.');
  }
}
