import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { api, rupees } from '../api';
import { WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { AppButton, Field, Notice, PageIntro, Pill, Surface } from '../components/ui';
import { shortDate } from '../utils/dates';

const PRESETS = [200, 500, 1000, 2000];

const TX_LABELS = {
  TOPUP: 'Added money',
  SPEND: 'Paid',
  WITHDRAW: 'Withdrawn',
  REFUND: 'Refund',
  EARNING: 'Host earning',
  EXPIRE: 'Credit expired',
};
const txLabel = (tx) => (tx.type === 'ADJUST' ? (tx.provider === 'PROMO' ? 'Promo credit' : 'Adjustment') : TX_LABELS[tx.type] || tx.type);
const txOut = (tx) => ['SPEND', 'WITHDRAW', 'EXPIRE'].includes(tx.type);

export default function WalletScreen({ user, setTab, layout, deepLinkOrderId, clearDeepLink }) {
  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [offers, setOffers] = useState([]);
  const [amount, setAmount] = useState('500');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('gold');
  const pendingOrder = useRef(null);

  const say = (text, nextTone = 'gold') => { setMessage(text); setTone(nextTone); };

  const refresh = useCallback(async () => {
    const [w, t, o] = await Promise.all([
      api.get('/wallet'),
      api.get('/wallet/transactions', { limit: 20 }),
      api.get('/offers/mine').catch(() => ({ data: [] })),
    ]);
    setWallet(w.data);
    setTxs(t.data || []);
    setOffers(o.data || []);
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh().catch((error) => say(error.message, 'error'));
  }, [user, refresh]);

  // Check an order with the server: after returning from the browser, or from the app link.
  const verifyOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await api.post('/wallet/topup/verify', { orderId });
      if (res.paid) {
        pendingOrder.current = null;
        say('Payment received. Your wallet has been updated.');
      } else {
        say('Payment not confirmed yet. If you paid, it will show here within a minute; pull back to this tab to check again.');
      }
      await refresh();
    } catch (error) {
      say(error.message, 'error');
    }
  }, [refresh]);

  useEffect(() => {
    if (!user || !deepLinkOrderId) return;
    verifyOrder(deepLinkOrderId);
    clearDeepLink?.();
  }, [user, deepLinkOrderId, verifyOrder, clearDeepLink]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingOrder.current) verifyOrder(pendingOrder.current);
    });
    return () => sub.remove();
  }, [verifyOrder]);

  const addMoney = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 10) return say('Enter at least ₹10.', 'error');
    setBusy(true);
    say('');
    try {
      const res = await api.post('/wallet/topup', { amount: value, returnTo: 'app' });
      if (res.mock) {
        say(`${rupees(value)} added (test mode).`);
        await refresh();
        return;
      }
      const { orderId, paymentSessionId, cashfreeMode } = res.data;
      pendingOrder.current = orderId;
      const url = `${WEBSITE_URL}/pay?session=${encodeURIComponent(paymentSessionId)}&mode=${cashfreeMode === 'sandbox' ? 'sandbox' : 'production'}`;
      say('Complete the payment in your browser, then come back here. Your balance updates automatically.');
      await Linking.openURL(url);
    } catch (error) {
      say(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.page}>
        <PageIntro eyebrow="WALLET" title="Pay for rentals in one tap." description="Add money with UPI, cards or netbanking, see your promo credit and the offers sent to you." layout={layout} />
        <Surface>
          <Text style={styles.cardTitle}>Sign in to see your wallet</Text>
          <AppButton onPress={() => setTab('Account')}>Sync In</AppButton>
        </Surface>
      </View>
    );
  }

  const credits = wallet?.promoCredits || [];
  return (
    <View style={styles.page}>
      <PageIntro eyebrow="WALLET" title="Your wallet." description="Promo credit is used first on car and bike rentals and can't be withdrawn." layout={layout} />

      <Surface style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
        <Text style={styles.balance}>{rupees(wallet?.balance)}</Text>
        {wallet?.promoBalance > 0 && <Text style={styles.balanceMeta}>+ {rupees(wallet.promoBalance)} promo credit</Text>}
      </Surface>

      {credits.length > 0 && (
        <Surface style={styles.section}>
          <Text style={styles.sectionTitle}>Promo credit</Text>
          <Text style={styles.muted}>Spent automatically on rentals, soonest-expiring first.</Text>
          {credits.map((c) => (
            <View key={c.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{rupees(c.remaining)}</Text>
                <Text style={styles.muted}>{c.note || (c.source === 'REFERRAL' ? 'Referral reward' : 'Promo credit')}</Text>
              </View>
              <Text style={[styles.expiry, !c.expiresAt && styles.noExpiry]}>{c.expiresAt ? `Use by ${shortDate(c.expiresAt)}` : 'No expiry'}</Text>
            </View>
          ))}
        </Surface>
      )}

      {offers.length > 0 && (
        <Surface style={styles.section}>
          <Text style={styles.sectionTitle}>Your offers</Text>
          <Text style={styles.muted}>Applied automatically when you pay for a matching rental.</Text>
          {offers.map((o) => (
            <View key={o.id} style={styles.offer}>
              <Pill tone="blue">{o.validUntil ? `Until ${shortDate(o.validUntil)}` : 'No end date'}</Pill>
              <Text style={styles.rowTitle}>{o.title}</Text>
              <Text style={styles.muted}>{o.summary}{o.usesLeft > 1 ? ` · ${o.usesLeft} uses left` : ''}</Text>
            </View>
          ))}
          <AppButton variant="ghost" onPress={() => setTab('Rentals')}>Browse cars & bikes</AppButton>
        </Surface>
      )}

      <Surface style={styles.section}>
        <Text style={styles.sectionTitle}>Add money</Text>
        <Text style={styles.muted}>Pay securely with UPI, cards or netbanking through Cashfree.</Text>
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              accessibilityRole="button"
              accessibilityState={{ selected: Number(amount) === p }}
              onPress={() => setAmount(String(p))}
              style={[styles.preset, Number(amount) === p && styles.presetActive]}
            >
              <Text style={[styles.presetText, Number(amount) === p && styles.presetTextActive]}>{rupees(p)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="AMOUNT (₹)" value={amount} onChangeText={setAmount} keyboardType="number-pad" maxLength={6} />
        <AppButton onPress={addMoney} disabled={busy}>{busy ? 'Opening payment…' : `Add ${rupees(Number(amount) || 0)}`}</AppButton>
        <Notice tone={tone}>{message}</Notice>
      </Surface>

      <Surface style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        {txs.length === 0 ? (
          <Text style={styles.muted}>No transactions yet.</Text>
        ) : txs.map((tx) => (
          <View key={tx.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{txLabel(tx)}</Text>
              <Text style={styles.muted} numberOfLines={1}>{tx.description || '—'}</Text>
              <Text style={styles.small}>{shortDate(tx.createdAt)} · {tx.status}</Text>
            </View>
            <Text style={[styles.amount, txOut(tx) ? styles.amountOut : styles.amountIn]}>{txOut(tx) ? '−' : '+'}{rupees(tx.amount)}</Text>
          </View>
        ))}
        <AppButton variant="ghost" onPress={() => Linking.openURL(`${WEBSITE_URL}/wallet`)}>Withdraw on the website</AppButton>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  cardTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  balanceCard: { backgroundColor: colors.blueDark, borderColor: colors.blueDark, marginBottom: 14 },
  balanceLabel: { color: '#cfe6ff', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  balance: { color: colors.white, fontSize: 38, fontWeight: '900', marginTop: 4 },
  balanceMeta: { color: '#e5f1ff', marginTop: 4, fontWeight: '600' },
  section: { marginBottom: 14 },
  sectionTitle: { color: colors.navy, fontSize: 19, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20, marginTop: 2 },
  small: { color: colors.subtle, fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowMain: { flex: 1 },
  rowTitle: { color: colors.navy, fontWeight: '800', fontSize: 16, marginTop: 6 },
  expiry: { color: '#b45309', fontWeight: '800', fontSize: 13 },
  noExpiry: { color: colors.subtle, fontWeight: '600' },
  offer: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  preset: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.inputBorder, justifyContent: 'center', backgroundColor: colors.white },
  presetActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  presetText: { color: colors.navy, fontWeight: '800' },
  presetTextActive: { color: colors.white },
  amount: { fontWeight: '900', fontSize: 15 },
  amountIn: { color: '#047857' },
  amountOut: { color: colors.danger },
});
