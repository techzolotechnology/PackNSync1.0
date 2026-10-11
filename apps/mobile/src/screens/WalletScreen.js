import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { AppButton, Chip, EmptyState, Field, Icon, ListRow, Notice, PageIntro, Pill, SectionHeader, Skeleton, SkeletonList, Surface } from '../components/ui';
import { shortDate } from '../utils/dates';
import { errorFeedback, successFeedback } from '../utils/haptics';

const PRESETS = [200, 500, 1000, 2000];

const TX_STYLES = {
  TOPUP: { label: 'Added money', icon: 'add-circle', tone: 'green' },
  SPEND: { label: 'Paid', icon: 'car-sport', tone: 'blue' },
  WITHDRAW: { label: 'Withdrawn', icon: 'arrow-up-circle', tone: 'gray' },
  REFUND: { label: 'Refund', icon: 'return-down-back', tone: 'green' },
  EARNING: { label: 'Host earning', icon: 'trending-up', tone: 'green' },
  EXPIRE: { label: 'Credit expired', icon: 'time', tone: 'red' },
};
const txStyle = (tx) => {
  if (tx.type === 'ADJUST') return tx.provider === 'PROMO' ? { label: 'Promo credit', icon: 'gift', tone: 'gold' } : { label: 'Adjustment', icon: 'swap-horizontal', tone: 'gray' };
  return TX_STYLES[tx.type] || { label: tx.type, icon: 'ellipse', tone: 'gray' };
};
const txOut = (tx) => ['SPEND', 'WITHDRAW', 'EXPIRE'].includes(tx.type);
const daysLeft = (iso) => Math.ceil((new Date(iso) - Date.now()) / 86400000);

export default function WalletScreen({ user, setTab, layout, deepLinkOrderId, clearDeepLink, registerRefresh }) {
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
  useEffect(() => (user ? registerRefresh?.(refresh) : undefined), [user, registerRefresh, refresh]);

  // Check an order with the server: after returning from the browser, or from the app link.
  const verifyOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await api.post('/wallet/topup/verify', { orderId });
      if (res.paid) {
        pendingOrder.current = null;
        successFeedback();
        say('Payment received. Your wallet has been updated.', 'success');
      } else {
        say('Payment not confirmed yet. If you paid, it will show here within a minute — pull down to check again.');
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
    if (!Number.isFinite(value) || value < 10) {
      errorFeedback();
      return say('Enter at least ₹10.', 'error');
    }
    setBusy(true);
    say('');
    try {
      const res = await api.post('/wallet/topup', { amount: value, returnTo: 'app' });
      if (res.mock) {
        successFeedback();
        say(`${rupees(value)} added (test mode).`, 'success');
        await refresh();
        return;
      }
      const { orderId, paymentSessionId, cashfreeMode } = res.data;
      pendingOrder.current = orderId;
      const url = `${WEBSITE_URL}/pay?session=${encodeURIComponent(paymentSessionId)}&mode=${cashfreeMode === 'sandbox' ? 'sandbox' : 'production'}`;
      say('Complete the payment in your browser, then come back here. Your balance updates automatically.');
      await Linking.openURL(url);
    } catch (error) {
      errorFeedback();
      say(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.page}>
        <PageIntro eyebrow="WALLET" icon="wallet" title="Pay for rentals in one tap." description="Add money with UPI, cards or netbanking, see your promo credit and the offers sent to you." layout={layout} />
        <Surface>
          <EmptyState icon="lock-closed" title="Sign in to see your wallet" text="Your balance, promo credit and offers live in your PickAndSync account." actionLabel="Sync In" actionIcon="log-in-outline" onAction={() => setTab('Account')} />
        </Surface>
      </View>
    );
  }

  const credits = wallet?.promoCredits || [];
  return (
    <View style={styles.page}>
      <PageIntro eyebrow="WALLET" icon="wallet" title="Your wallet." description="Promo credit is used first on car and bike rentals and can't be withdrawn." layout={layout} />

      <View style={styles.balanceCard}>
        <View style={styles.ringLarge} />
        <View style={styles.ringSmall} />
        <View style={styles.balanceTop}>
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <Icon name="shield-checkmark" size={18} color="#cfe6ff" />
        </View>
        {wallet ? <Text style={styles.balance}>{rupees(wallet.balance)}</Text> : <Skeleton width={150} height={40} radius={10} style={styles.balanceSkeleton} />}
        {wallet?.promoBalance > 0 && (
          <View style={styles.promoBadge}>
            <Icon name="gift" size={14} color={colors.goldText} />
            <Text style={styles.promoBadgeText}>+ {rupees(wallet.promoBalance)} promo credit</Text>
          </View>
        )}
      </View>

      {credits.length > 0 && (
        <Surface style={styles.section}>
          <SectionHeader title="Promo credit" subtitle="Spent automatically on rentals, soonest-expiring first." />
          {credits.map((c, index) => {
            const left = c.expiresAt ? daysLeft(c.expiresAt) : null;
            return (
              <ListRow
                key={c.id}
                icon="gift"
                tone="gold"
                title={rupees(c.remaining)}
                subtitle={c.note || (c.source === 'REFERRAL' ? 'Referral reward' : 'Promo credit')}
                last={index === credits.length - 1}
                right={c.expiresAt
                  ? <Pill tone={left <= 3 ? 'red' : 'gold'} icon="time-outline">{left <= 1 ? 'Ends today' : `Use by ${shortDate(c.expiresAt)}`}</Pill>
                  : <Pill tone="gray">No expiry</Pill>}
              />
            );
          })}
        </Surface>
      )}

      {offers.length > 0 && (
        <Surface style={styles.section}>
          <SectionHeader title="Your offers" subtitle="Applied automatically when you pay for a matching rental." actionLabel="Use now" actionIcon="car-sport-outline" onAction={() => setTab('Rentals')} />
          {offers.map((o, index) => (
            <ListRow
              key={o.id}
              icon="pricetag"
              tone="blue"
              title={o.title}
              subtitle={`${o.summary}${o.usesLeft > 1 ? ` · ${o.usesLeft} uses left` : ''}`}
              last={index === offers.length - 1}
              right={<Pill tone="blue">{o.validUntil ? `Until ${shortDate(o.validUntil)}` : 'Ongoing'}</Pill>}
            />
          ))}
        </Surface>
      )}

      <Surface style={styles.section}>
        <SectionHeader title="Add money" subtitle="Pay securely with UPI, cards or netbanking through Cashfree." />
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <Chip key={p} label={rupees(p)} active={Number(amount) === p} onPress={() => setAmount(String(p))} />
          ))}
        </View>
        <Field label="AMOUNT (₹)" icon="cash-outline" value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} />
        <AppButton icon="add-circle-outline" onPress={addMoney} loading={busy}>{busy ? 'Opening payment…' : `Add ${rupees(Number(amount) || 0)}`}</AppButton>
        <View style={styles.secureRow}>
          <Icon name="lock-closed" size={13} color={colors.subtle} />
          <Text style={styles.secureText}>Payments are processed by Cashfree. We never see your card or UPI PIN.</Text>
        </View>
        <Notice tone={tone}>{message}</Notice>
      </Surface>

      <Surface style={styles.section}>
        <SectionHeader title="Activity" actionLabel="Withdraw" actionIcon="open-outline" onAction={() => Linking.openURL(`${WEBSITE_URL}/wallet`)} />
        {!wallet ? (
          <SkeletonList rows={4} />
        ) : txs.length === 0 ? (
          <EmptyState icon="receipt-outline" title="No transactions yet" text="Money you add, spend or earn shows up here." />
        ) : txs.map((tx, index) => {
          const look = txStyle(tx);
          const out = txOut(tx);
          return (
            <ListRow
              key={tx.id}
              icon={look.icon}
              tone={look.tone}
              title={look.label}
              subtitle={tx.description || '—'}
              caption={`${shortDate(tx.createdAt)}${tx.status !== 'SUCCESS' ? ` · ${tx.status.toLowerCase()}` : ''}`}
              last={index === txs.length - 1}
              right={<Text style={[styles.amount, out ? styles.amountOut : styles.amountIn]}>{out ? '−' : '+'}{rupees(tx.amount)}</Text>}
            />
          );
        })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  balanceCard: { backgroundColor: colors.blueDark, borderRadius: 24, padding: 22, marginBottom: 14, overflow: 'hidden' },
  ringLarge: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 28, borderColor: 'rgba(255,255,255,0.07)', top: -70, right: -60 },
  ringSmall: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, right: 70 },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: '#cfe6ff', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  balance: { color: colors.white, fontSize: 40, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  balanceSkeleton: { marginTop: 10, opacity: 0.4 },
  promoBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goldPale, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginTop: 10 },
  promoBadgeText: { color: colors.goldText, fontWeight: '800', fontSize: 13 },
  section: { marginBottom: 14 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 14 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  secureText: { color: colors.subtle, fontSize: 12, flex: 1 },
  amount: { fontWeight: '900', fontSize: 15 },
  amountIn: { color: colors.success },
  amountOut: { color: colors.danger },
});
