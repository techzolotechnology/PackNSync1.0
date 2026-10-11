import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { colors } from '../theme';
import { AppButton, EmptyState, Icon, IconCircle, Notice, PageIntro, Pill, SectionHeader, SkeletonList, Surface } from '../components/ui';
import { shortDate } from '../utils/dates';
import { errorFeedback, successFeedback } from '../utils/haptics';

const STATUS = {
  PENDING: { text: 'Waiting for the host', icon: 'hourglass-outline', tone: 'gold' },
  CONFIRMED: { text: 'Confirmed — pay to lock it in', icon: 'checkmark-circle-outline', tone: 'blue' },
  PAID: { text: 'Paid', icon: 'shield-checkmark-outline', tone: 'green' },
  COMPLETED: { text: 'Completed', icon: 'flag-outline', tone: 'green' },
  REJECTED: { text: 'Declined by host', icon: 'close-circle-outline', tone: 'red' },
  CANCELLED: { text: 'Cancelled', icon: 'ban-outline', tone: 'gray' },
};

const vehicleName = (b) => `${b.listing?.vehicle?.make || ''} ${b.listing?.vehicle?.model || ''}`.trim() || 'Vehicle';
const vehicleIcon = (b) => (['BIKE', 'SCOOTER'].includes(String(b.listing?.vehicle?.type || '').toUpperCase()) ? 'bicycle' : 'car-sport');

export default function BookingsScreen({ user, setTab, layout, registerRefresh }) {
  const [mine, setMine] = useState([]);
  const [hosting, setHosting] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('gold');

  const say = (text, nextTone = 'gold') => { setMessage(text); setTone(nextTone); };

  const load = useCallback(async () => {
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
      setLoaded(true);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => (user ? registerRefresh?.(load) : undefined), [user, registerRefresh, load]);

  const run = async (id, action, success) => {
    setBusyId(id);
    say('');
    try {
      await action();
      successFeedback();
      say(success, 'success');
    } catch (error) {
      errorFeedback();
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
        <PageIntro eyebrow="MY BOOKINGS" icon="calendar" title="Your rentals in one place." description="Track requests, pay for confirmed bookings and answer requests for your vehicles." layout={layout} />
        <Surface>
          <EmptyState icon="lock-closed" title="Sign in to see your bookings" text="Requests, payments and trips you host all show up here." actionLabel="Sync In" actionIcon="log-in-outline" onAction={() => setTab('Account')} />
        </Surface>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <PageIntro eyebrow="MY BOOKINGS" icon="calendar" title="Your rentals." description="Pay for confirmed bookings from your wallet. Offers are applied automatically." layout={layout} />
      <Notice tone={tone}>{message}</Notice>
      {message.toLowerCase().includes('insufficient') && <AppButton icon="wallet-outline" onPress={() => setTab('Wallet')}>Add money to your wallet</AppButton>}

      {hosting.length > 0 && (
        <Surface style={[styles.section, styles.hostSection]}>
          <SectionHeader title="Requests for your vehicles" subtitle={`${hosting.length} waiting for your answer`} />
          {hosting.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.cardTop}>
                <IconCircle name={vehicleIcon(b)} tone="gold" />
                <View style={styles.flex}>
                  <Text style={styles.name}>{vehicleName(b)}</Text>
                  <View style={styles.metaRow}><Icon name="person-outline" size={13} color={colors.subtle} /><Text style={styles.meta}>{b.renter?.name || 'A renter'}</Text></View>
                  <View style={styles.metaRow}><Icon name="calendar-outline" size={13} color={colors.subtle} /><Text style={styles.meta}>{shortDate(b.startDate)} → {shortDate(b.endDate)}</Text></View>
                </View>
                <Text style={styles.earn}>{rupees(b.hostAmount ?? b.totalPrice)}</Text>
              </View>
              <View style={styles.actions}>
                <AppButton compact icon="checkmark" loading={busyId === b.id} onPress={() => respond(b, 'CONFIRMED')} style={styles.flex}>Accept</AppButton>
                <AppButton compact variant="danger" icon="close" disabled={busyId === b.id} onPress={() => respond(b, 'REJECTED')} style={styles.flex}>Decline</AppButton>
              </View>
            </View>
          ))}
        </Surface>
      )}

      <Surface style={styles.section}>
        <SectionHeader title="My rentals" actionLabel="Find a ride" actionIcon="add" onAction={() => setTab('Rentals')} />
        {!loaded ? (
          <SkeletonList rows={3} />
        ) : mine.length === 0 ? (
          <EmptyState icon="car-sport-outline" title="No rentals yet" text="Book a car or bike and it shows up here, from request to return." actionLabel="Find a car or bike" actionIcon="search" onAction={() => setTab('Rentals')} />
        ) : mine.map((b, index) => {
          const quote = quotes[b.id];
          const canPay = b.status === 'CONFIRMED';
          const status = STATUS[b.status] || { text: b.status, icon: 'ellipse-outline', tone: 'gray' };
          return (
            <View key={b.id} style={[styles.card, index === mine.length - 1 && styles.cardLast]}>
              <View style={styles.cardTop}>
                <IconCircle name={vehicleIcon(b)} tone={status.tone} />
                <View style={styles.flex}>
                  <Text style={styles.name}>{vehicleName(b)}</Text>
                  {!!b.listing?.location && <View style={styles.metaRow}><Icon name="location-outline" size={13} color={colors.subtle} /><Text style={styles.meta}>{b.listing.location}</Text></View>}
                  <View style={styles.metaRow}><Icon name="calendar-outline" size={13} color={colors.subtle} /><Text style={styles.meta}>{shortDate(b.startDate)} → {shortDate(b.endDate)}</Text></View>
                </View>
                <View style={styles.priceCol}>
                  <Text style={styles.price}>{rupees(b.totalPrice)}</Text>
                  {b.platformFee > 0 && <Text style={styles.small}>incl. {rupees(b.platformFee)} fee</Text>}
                </View>
              </View>
              <Pill tone={status.tone} icon={status.icon} style={styles.status}>{status.text}</Pill>
              {canPay && quote?.discount > 0 && (
                <View style={styles.offerRow}>
                  <Icon name="pricetag" size={14} color={colors.success} />
                  <Text style={styles.offer}>{quote.offer.title}: −{rupees(quote.discount)} · you pay {rupees(quote.payable)}</Text>
                </View>
              )}
              {['PAID', 'COMPLETED'].includes(b.status) && b.discountAmount > 0 && (
                <View style={styles.offerRow}>
                  <Icon name="sparkles" size={14} color={colors.success} />
                  <Text style={styles.offer}>Offer saved you {rupees(b.discountAmount)}</Text>
                </View>
              )}
              {(canPay || b.status === 'PENDING') && (
                <View style={styles.actions}>
                  {canPay && (
                    <AppButton compact icon="wallet-outline" loading={busyId === b.id} onPress={() => pay(b)} style={styles.flex}>
                      {`Pay ${rupees(quote?.payable ?? b.totalPrice)}`}
                    </AppButton>
                  )}
                  <AppButton compact variant="ghost" icon="close-outline" disabled={busyId === b.id} onPress={() => cancel(b)}>Cancel</AppButton>
                </View>
              )}
            </View>
          );
        })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  flex: { flex: 1 },
  section: { marginBottom: 14, marginTop: 4 },
  hostSection: { borderColor: '#f5d76e', backgroundColor: '#fffdf5' },
  card: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  cardLast: { borderBottomWidth: 0, paddingBottom: 4 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  meta: { color: colors.muted, fontSize: 13 },
  priceCol: { alignItems: 'flex-end' },
  price: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  earn: { color: colors.success, fontWeight: '900', fontSize: 16 },
  small: { color: colors.subtle, fontSize: 11, marginTop: 2 },
  status: { marginTop: 10 },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  offer: { color: colors.success, fontWeight: '800', flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
