import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { colors } from '../theme';
import { AppButton, Notice, PageIntro, Pill, Surface } from '../components/ui';
import { shortDate } from '../utils/dates';

const STATUS_TEXT = {
  PENDING: 'Waiting for the host',
  CONFIRMED: 'Confirmed — pay to lock it in',
  PAID: 'Paid',
  COMPLETED: 'Completed',
  REJECTED: 'Declined by host',
  CANCELLED: 'Cancelled',
};

const vehicleName = (b) => `${b.listing?.vehicle?.make || ''} ${b.listing?.vehicle?.model || ''}`.trim() || 'Vehicle';

export default function BookingsScreen({ user, setTab, layout }) {
  const [mine, setMine] = useState([]);
  const [hosting, setHosting] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('gold');

  const say = (text, nextTone = 'gold') => { setMessage(text); setTone(nextTone); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [renter, host] = await Promise.all([
        api.get('/rentals/bookings/my'),
        api.get('/rentals/bookings/host').catch(() => ({ data: [] })),
      ]);
      const rentals = renter.data || [];
      setMine(rentals);
      setHosting((host.data || []).filter((b) => b.status === 'PENDING'));
      // What each confirmed booking costs right now, after any offer.
      const entries = await Promise.all(rentals.filter((b) => b.status === 'CONFIRMED').map(async (b) => {
        try {
          const q = await api.get(`/rentals/bookings/${b.id}/quote`);
          return [b.id, q.data];
        } catch {
          return [b.id, null];
        }
      }));
      setQuotes(Object.fromEntries(entries));
    } catch (error) {
      say(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const run = async (id, action, success) => {
    setBusyId(id);
    say('');
    try {
      await action();
      say(success);
    } catch (error) {
      say(error.message, 'error');
    } finally {
      setBusyId(null);
      load();
    }
  };

  const pay = (b) => {
    const quote = quotes[b.id];
    const payable = quote?.payable ?? b.totalPrice;
    run(
      b.id,
      () => api.post(`/rentals/bookings/${b.id}/pay`, { method: 'wallet', ...(quote ? { expectedAmount: payable } : {}) }),
      quote?.discount > 0 ? `Paid ${rupees(payable)} — ${rupees(quote.discount)} off with “${quote.offer.title}”.` : `Paid ${rupees(payable)} from your wallet.`,
    );
  };

  const cancel = (b) => Alert.alert('Cancel this booking?', vehicleName(b), [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Cancel booking', style: 'destructive', onPress: () => run(b.id, () => api.patch(`/rentals/bookings/${b.id}/cancel`), 'Booking cancelled.') },
  ]);

  const respond = (b, status) => run(
    b.id,
    () => api.patch(`/rentals/bookings/${b.id}/respond`, { status }),
    status === 'CONFIRMED' ? 'Request accepted. The renter can now pay.' : 'Request declined.',
  );

  if (!user) {
    return (
      <View style={styles.page}>
        <PageIntro eyebrow="MY BOOKINGS" title="Your rentals in one place." description="Track requests, pay for confirmed bookings and answer requests for your vehicles." layout={layout} />
        <Surface>
          <Text style={styles.title}>Sign in to see your bookings</Text>
          <AppButton onPress={() => setTab('Account')}>Sync In</AppButton>
        </Surface>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <PageIntro eyebrow="MY BOOKINGS" title="Your rentals." description="Pay for confirmed bookings from your wallet. Offers are applied automatically." layout={layout} />
      <Notice tone={tone}>{message}</Notice>

      {hosting.length > 0 && (
        <Surface style={styles.section}>
          <Text style={styles.title}>Requests for your vehicles</Text>
          {hosting.map((b) => (
            <View key={b.id} style={styles.card}>
              <Text style={styles.name}>{vehicleName(b)}</Text>
              <Text style={styles.muted}>{b.renter?.name || 'A renter'} · {shortDate(b.startDate)} → {shortDate(b.endDate)}</Text>
              <Text style={styles.muted}>You earn {rupees(b.hostAmount ?? b.totalPrice)}</Text>
              <View style={styles.actions}>
                <AppButton compact disabled={busyId === b.id} onPress={() => respond(b, 'CONFIRMED')}>Accept</AppButton>
                <AppButton compact variant="ghost" disabled={busyId === b.id} onPress={() => respond(b, 'REJECTED')}>Decline</AppButton>
              </View>
            </View>
          ))}
        </Surface>
      )}

      <Surface style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My rentals</Text>
          <AppButton compact variant="ghost" onPress={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</AppButton>
        </View>
        {mine.length === 0 ? (
          <>
            <Text style={styles.muted}>No rentals yet.</Text>
            <AppButton onPress={() => setTab('Rentals')}>Find a car or bike</AppButton>
          </>
        ) : mine.map((b) => {
          const quote = quotes[b.id];
          const canPay = b.status === 'CONFIRMED';
          return (
            <View key={b.id} style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>{vehicleName(b)}</Text>
                <Text style={styles.price}>{rupees(b.totalPrice)}</Text>
              </View>
              <Text style={styles.muted}>{b.listing?.location || ''} · {shortDate(b.startDate)} → {shortDate(b.endDate)}</Text>
              {b.platformFee > 0 && <Text style={styles.small}>{rupees(b.hostAmount)} + {rupees(b.platformFee)} service fee</Text>}
              <Pill tone={canPay ? 'blue' : 'gold'} style={styles.status}>{STATUS_TEXT[b.status] || b.status}</Pill>
              {canPay && quote?.discount > 0 && (
                <Text style={styles.offer}>{quote.offer.title}: −{rupees(quote.discount)} · you pay {rupees(quote.payable)}</Text>
              )}
              {['PAID', 'COMPLETED'].includes(b.status) && b.discountAmount > 0 && <Text style={styles.offer}>Offer saved you {rupees(b.discountAmount)}</Text>}
              <View style={styles.actions}>
                {canPay && (
                  <AppButton compact disabled={busyId === b.id} onPress={() => pay(b)}>
                    {busyId === b.id ? 'Paying…' : `Pay ${rupees(quote?.payable ?? b.totalPrice)}`}
                  </AppButton>
                )}
                {['PENDING', 'CONFIRMED'].includes(b.status) && (
                  <AppButton compact variant="ghost" disabled={busyId === b.id} onPress={() => cancel(b)}>Cancel</AppButton>
                )}
              </View>
            </View>
          );
        })}
        {message.toLowerCase().includes('insufficient') && <AppButton onPress={() => setTab('Wallet')}>Add money to your wallet</AppButton>}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  section: { marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.navy, fontSize: 19, fontWeight: '900', marginBottom: 8 },
  card: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { color: colors.navy, fontWeight: '900', fontSize: 16, flexShrink: 1 },
  price: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  muted: { color: colors.muted, lineHeight: 20, marginTop: 3 },
  small: { color: colors.subtle, fontSize: 12, marginTop: 3 },
  status: { marginTop: 8 },
  offer: { color: '#047857', fontWeight: '800', marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
});
