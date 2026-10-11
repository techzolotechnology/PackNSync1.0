import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { rupees } from '../api';
import { WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { checkoutHtml, classifyPaymentUrl, parseIntentUrl } from '../utils/payment';
import { Icon, IconButton } from './ui';

/**
 * Cashfree checkout inside the app. `payment` is { orderId, paymentSessionId,
 * mode, amount } while open; onFinish({ orderId, returned }) fires once, when
 * Cashfree hands back (returned: true) or the person leaves (returned: false).
 */
export default function PaymentSheet({ payment, onFinish }) {
  const finished = useRef(false);

  useEffect(() => { finished.current = false; }, [payment?.orderId]);

  const finish = useCallback((returned) => {
    if (finished.current || !payment) return;
    finished.current = true;
    onFinish({ orderId: payment.orderId, returned });
  }, [onFinish, payment]);

  // UPI apps (GPay, PhonePe, Paytm…) and other non-web links open outside, then come back here.
  const openOutside = useCallback(async (url) => {
    const intent = parseIntentUrl(url);
    const target = intent?.appUrl || url;
    try {
      await Linking.openURL(target);
    } catch {
      Alert.alert('App not found', 'No app on this phone can open that payment option. Please choose another way to pay.');
    }
  }, []);

  const allowNavigation = useCallback((url) => {
    const next = classifyPaymentUrl(url);
    if (next.action === 'done' || next.action === 'close') {
      finish(true);
      return false;
    }
    if (next.action === 'external') {
      openOutside(url);
      return false;
    }
    return true;
  }, [finish, openOutside]);

  const askToLeave = () => Alert.alert(
    'Leave payment?',
    'If you have already paid, your wallet still updates within a minute.',
    [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => finish(false) },
    ],
  );

  return (
    <Modal visible={!!payment} animationType="slide" onRequestClose={askToLeave}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <IconButton icon="close" label="Leave payment" tone="gray" size={38} onPress={askToLeave} />
          <View style={styles.titleWrap}>
            <View style={styles.titleRow}>
              <Icon name="lock-closed" size={14} color={colors.success} />
              <Text style={styles.title}>Secure payment</Text>
            </View>
            {!!payment && <Text style={styles.subtitle}>Adding {rupees(payment.amount)} · Cashfree</Text>}
          </View>
          <View style={styles.headerSpacer} />
        </View>
        {!!payment && (
          <WebView
            source={{ html: checkoutHtml(payment.paymentSessionId, payment.mode), baseUrl: WEBSITE_URL }}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(request) => allowNavigation(request.url)}
            onNavigationStateChange={(state) => {
              // Backup for redirects that skip the check above.
              if (classifyPaymentUrl(state.url).action === 'done') finish(true);
            }}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.blue} />
                <Text style={styles.loadingText}>Opening secure payment…</Text>
              </View>
            )}
            style={styles.web}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  headerSpacer: { width: 38 },
  web: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bluePale },
  loadingText: { color: colors.muted, fontWeight: '700' },
});
