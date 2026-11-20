import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { API_BASE_URL, WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { AppButton, Chip, DateStepper, EmptyState, Field, Icon, Notice, PageIntro, Pill, ResponsiveGrid, SegmentedControl, Skeleton, Surface } from '../components/ui';
import { addDays, rentalDays, today, tomorrow } from '../utils/dates';
import { errorFeedback, successFeedback } from '../utils/haptics';

const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');
const imageUrl = (src) => {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith('/') ? `${API_ORIGIN}${src}` : null;
};
const round2 = (n) => Math.round(n * 100) / 100;
const isTwoWheeler = (vehicle) => ['BIKE', 'SCOOTER'].includes(String(vehicle?.type || '').toUpperCase());

const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Goa', 'Pune', 'Jaipur'];
const KINDS = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'car', label: 'Cars', icon: 'car-sport-outline' },
  { key: 'bike', label: 'Bikes', icon: 'bicycle-outline' },
];

function ListingSkeleton() {
  return (
    <Surface style={styles.listingCard}>
      <Skeleton height={150} radius={16} />
      <Skeleton width="70%" height={18} style={styles.skeletonGap} />
      <Skeleton width="45%" height={13} style={styles.skeletonGap} />
      <Skeleton height={48} radius={16} style={styles.skeletonGap} />
    </Surface>
  );
}

export default function RentalsScreen({ user, setTab, layout, registerRefresh }) {
  const [location, setLocation] = useState('');
  const [kind, setKind] = useState('all');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [listings, setListings] = useState([]);
  const [searched, setSearched] = useState(false);
  const [feePercent, setFeePercent] = useState(2);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('gold');
  // Booking feedback shows inside the tapped card, which is where the person is looking.
  const [feedback, setFeedback] = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [termsFor, setTermsFor] = useState(null);
  const [bookedId, setBookedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const days = useMemo(() => rentalDays(startDate, endDate), [startDate, endDate]);

  const say = (text, nextTone = 'gold') => { setMessage(text); setTone(nextTone); };
  const tell = (id, text, nextTone = 'gold') => setFeedback(text ? { id, text, tone: nextTone } : null);

  // Keep the return at least a day after pickup.
  const changeStart = (next) => {
    setStartDate(next);
    if (endDate <= next) setEndDate(addDays(next, 1));
  };

  const load = useCallback(async (overrides = {}) => {
    const query = { location, kind, startDate, endDate, ...overrides };
    setLoading(true);
    say('');
    setFeedback(null);
    setTermsFor(null);
    try {
      const response = await api.get('/rentals/listings', {
        location: query.location,
        kind: query.kind === 'all' ? undefined : query.kind,
        startDate: query.startDate,
        endDate: query.endDate,
      });
      setListings(response.data || []);
      setSearched(true);
      if (Number.isFinite(response.meta?.platformFeePercent)) setFeePercent(response.meta.platformFeePercent);
    } catch (error) {
      say(error.message, 'error');
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [location, kind, startDate, endDate]);

  useEffect(() => (searched ? registerRefresh?.(load) : undefined), [searched, registerRefresh, load]);

  const pickCity = (city) => {
    setLocation(city);
    load({ location: city });
  };

  const pickKind = (next) => {
    setKind(next);
    if (searched) load({ kind: next });
  };

  const sendRequest = async (listing) => {
    setNeedsVerification(false);
    try {
      const res = await api.post('/rentals/bookings', { listingId: listing.id, startDate, endDate });
      const total = res.data?.totalPrice ?? res.pricing?.totalPrice;
      setBookedId(listing.id);
      successFeedback();
      tell(listing.id, `Request sent${total ? ` (${rupees(total)} incl. service fee)` : ''}. Pay from My Bookings once the host confirms.`, 'success');
    } catch (error) {
      if (/verif|aadhaar|licen[cs]e|kyc/i.test(error.message)) setNeedsVerification(true);
      errorFeedback();
      tell(listing.id, error.message, 'error');
    }
  };

  // First booking: show the Rental Terms once, like the website.
  const book = async (listing) => {
    if (!user) return setTab('Account');
    tell(null);
    try {
      const status = await api.get('/verifications/policies/status');
      if (!status.data?.status?.RENTAL_TERMS) {
        setTermsFor(listing);
        return;
      }
    } catch {
      // If the check fails the server still enforces it when booking.
    }
    sendRequest(listing);
  };

  const acceptAndBook = async () => {
    const listing = termsFor;
    setTermsFor(null);
    try {
      await api.post('/verifications/policies/accept', { policyType: 'RENTAL_TERMS' });
      sendRequest(listing);
    } catch (error) {
      tell(listing.id, error.message, 'error');
    }
  };

  return (
    <View>
      <PageIntro eyebrow="CARS & BIKES" icon="car-sport" title="Pick your next ride." description={`Self-drive cars and bikes from verified local hosts. Prices include a ${feePercent}% service fee.`} layout={layout} />
      <Surface style={styles.searchPanel}>
        <SegmentedControl options={KINDS} value={kind} onChange={pickKind} />
        <Field label="PICKUP CITY" icon="location-outline" value={location} onChangeText={setLocation} placeholder="Bengaluru" autoCapitalize="words" returnKeyType="search" onSubmitEditing={() => load()} />
        <View style={styles.cityRow}>
          {CITIES.map((city) => <Chip key={city} label={city} active={location.trim().toLowerCase() === city.toLowerCase()} onPress={() => pickCity(city)} />)}
        </View>
        <ResponsiveGrid columns={layout.formColumns} gap={12}>
          <DateStepper label="PICKUP" value={startDate} min={today} onChange={changeStart} />
          <DateStepper label="RETURN" value={endDate} min={addDays(startDate, 1)} onChange={setEndDate} />
        </ResponsiveGrid>
        <AppButton icon="search" onPress={() => load()} loading={loading}>{loading ? 'Searching…' : `Search · ${days} ${days === 1 ? 'day' : 'days'}`}</AppButton>
        <Notice tone={tone}>{message}</Notice>
      </Surface>

      {!loading && listings.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsEyebrow}>AVAILABLE NEARBY</Text>
          <Text style={styles.resultsTitle}>{listings.length} {listings.length === 1 ? 'vehicle' : 'vehicles'} found</Text>
        </View>
      )}

      {loading ? (
        <ResponsiveGrid columns={layout.cardColumns} gap={14}>
          <ListingSkeleton />
          <ListingSkeleton />
        </ResponsiveGrid>
      ) : listings.length ? (
        <ResponsiveGrid columns={layout.cardColumns} gap={14}>
          {listings.map((listing) => {
            const vehicle = listing.vehicle || {};
            const hostTotal = Number(listing.pricePerDay || 0) * days;
            const total = round2(hostTotal * (1 + feePercent / 100));
            const photo = imageUrl(vehicle.images?.[0]);
            const twoWheeler = isTwoWheeler(vehicle);
            return (
              <Surface key={listing.id} style={styles.listingCard}>
                <View style={styles.media}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" accessibilityLabel={`${vehicle.make || ''} ${vehicle.model || ''}`} />
                  ) : (
                    <View style={styles.vehicleVisual}><Icon name={twoWheeler ? 'bicycle' : 'car-sport'} size={54} color={colors.blue} /></View>
                  )}
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>{rupees(listing.pricePerDay)}</Text>
                    <Text style={styles.priceBadgeUnit}>/day</Text>
                  </View>
                </View>
                <Text style={styles.vehicleName}>{vehicle.make || 'Vehicle'} {vehicle.model || ''}</Text>
                {listing.host?.businessProfile?.hostType === 'RENTAL_SHOP' && <Text>{listing.host.businessProfile.businessName}{listing.host.businessProfile.status === 'APPROVED' ? ' · Verified rental business' : ''}</Text>}
                <View style={styles.metaRow}>
                  <Pill tone="blue" icon="location-outline">{listing.location || 'Local pickup'}</Pill>
                  {!!vehicle.seats && <Pill tone="gray" icon="people-outline">{vehicle.seats} seats</Pill>}
                  {!!vehicle.fuelType && <Pill tone="gray" icon="speedometer-outline">{vehicle.fuelType}</Pill>}
                  {!!vehicle.transmission && !twoWheeler && <Pill tone="gray" icon="cog-outline">{vehicle.transmission}</Pill>}
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.total}>{rupees(total)}</Text>
                  <Text style={styles.totalNote}>for {days} {days === 1 ? 'day' : 'days'}, incl. {feePercent}% fee</Text>
                </View>
                {termsFor?.id === listing.id ? (
                  <View style={styles.terms}>
                    <View style={styles.termsHead}><Icon name="document-text" size={18} color={colors.blue} /><Text style={styles.termsTitle}>Rental Terms</Text></View>
                    <Text style={styles.termsText}>
                      Before your first booking, please read and accept the PickAndSync Rental Terms. You only need to do this once.
                    </Text>
                    <AppButton variant="ghost" icon="open-outline" onPress={() => Linking.openURL(`${WEBSITE_URL}/terms`)}>Read the full terms</AppButton>
                    <AppButton icon="checkmark-circle-outline" onPress={acceptAndBook}>Accept and request booking</AppButton>
                    <AppButton variant="ghost" onPress={() => setTermsFor(null)}>Not now</AppButton>
                  </View>
                ) : (
                  <AppButton icon={bookedId === listing.id ? 'checkmark-done' : 'flash-outline'} onPress={() => book(listing)} disabled={bookedId === listing.id}>{bookedId === listing.id ? 'Request sent' : 'Request Booking'}</AppButton>
                )}
                {feedback?.id === listing.id && (
                  <>
                    <Notice tone={feedback.tone}>{feedback.text}</Notice>
                    {needsVerification && (
                      <AppButton variant="ghost" icon="shield-checkmark-outline" onPress={() => Linking.openURL(`${WEBSITE_URL}/verify`)}>Verify your ID on the website</AppButton>
                    )}
                    {bookedId === listing.id && <AppButton variant="soft" icon="calendar-outline" onPress={() => setTab('Bookings')}>Go to My Bookings</AppButton>}
                  </>
                )}
              </Surface>
            );
          })}
        </ResponsiveGrid>
      ) : (
        <Surface>
          <EmptyState
            icon={searched ? 'search-outline' : 'compass-outline'}
            title={searched ? 'No vehicles match yet' : 'Where are you picking up?'}
            text={searched ? 'Try another city, shift your dates, or switch between cars and bikes.' : 'Pick a city above to see cars and bikes you can book for your dates.'}
            actionLabel="Host your own vehicle"
            actionIcon="key-outline"
            onAction={() => setTab('Host')}
          />
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchPanel: { marginBottom: 22 },
  cityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -2, marginBottom: 14 },
  resultsHeader: { marginBottom: 12 },
  resultsEyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  resultsTitle: { color: colors.navy, fontSize: 22, fontWeight: '900', marginTop: 4 },
  listingCard: { padding: 14 },
  skeletonGap: { marginTop: 12 },
  media: { marginBottom: 14 },
  photo: { height: 170, borderRadius: 16, backgroundColor: colors.blueSoft },
  vehicleVisual: { height: 130, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  priceBadge: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'baseline', backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  priceBadgeText: { color: colors.navy, fontWeight: '900', fontSize: 15 },
  priceBadgeUnit: { color: colors.subtle, fontWeight: '700', fontSize: 12, marginLeft: 2 },
  vehicleName: { color: colors.navy, fontWeight: '900', fontSize: 20, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  total: { color: colors.blue, fontWeight: '900', fontSize: 20 },
  totalNote: { color: colors.muted, fontSize: 13 },
  terms: { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  termsHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  termsTitle: { color: colors.navy, fontSize: 18, fontWeight: '900' },
  termsText: { color: colors.muted, lineHeight: 21, marginVertical: 8 },
});
