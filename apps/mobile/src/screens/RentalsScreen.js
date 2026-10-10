import React, { useMemo, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { API_BASE_URL, WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { AppButton, Field, Notice, PageIntro, Pill, ResponsiveGrid, Surface } from '../components/ui';
import { rentalDays, today, tomorrow } from '../utils/dates';

const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');
const imageUrl = (src) => {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith('/') ? `${API_ORIGIN}${src}` : null;
};
const round2 = (n) => Math.round(n * 100) / 100;

export default function RentalsScreen({ user, setTab, layout }) {
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [listings, setListings] = useState([]);
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

  const load = async () => {
    setLoading(true);
    say('');
    setFeedback(null);
    setTermsFor(null);
    try {
      const response = await api.get('/rentals/listings', { location, startDate, endDate });
      setListings(response.data || []);
      if (Number.isFinite(response.meta?.platformFeePercent)) setFeePercent(response.meta.platformFeePercent);
      if (!(response.data || []).length) say('No vehicles match yet. Try another city or dates.');
    } catch (error) {
      say(error.message, 'error');
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (listing) => {
    setNeedsVerification(false);
    try {
      const res = await api.post('/rentals/bookings', { listingId: listing.id, startDate, endDate });
      const total = res.data?.totalPrice ?? res.pricing?.totalPrice;
      setBookedId(listing.id);
      tell(listing.id, `Request sent${total ? ` (${rupees(total)} incl. service fee)` : ''}. Pay from My Bookings once the host confirms.`);
    } catch (error) {
      if (/verif|aadhaar|licen[cs]e|kyc/i.test(error.message)) setNeedsVerification(true);
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
      <PageIntro eyebrow="CARS & BIKES" title="Pick your next ride." description="Self-drive cars and bikes from verified local hosts. Prices include a 2% service fee." layout={layout} />
      <Surface style={styles.searchPanel}>
        <ResponsiveGrid columns={layout.formColumns} gap={12}>
          <Field label="PICKUP CITY" value={location} onChangeText={setLocation} placeholder="Bengaluru" autoCapitalize="words" />
          <Field label="START DATE" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <Field label="END DATE" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <View style={styles.searchButtonWrap}><AppButton onPress={load} disabled={loading}>{loading ? 'Searching…' : 'Search Cars & Bikes'}</AppButton></View>
        </ResponsiveGrid>
        <Notice tone={tone}>{message}</Notice>
      </Surface>


      <View style={styles.resultsHeader}>
        <View><Text style={styles.resultsEyebrow}>AVAILABLE NEARBY</Text><Text style={styles.resultsTitle}>{listings.length ? `${listings.length} vehicles found` : 'Explore local wheels'}</Text></View>
        <Pill tone="blue">{days} {days === 1 ? 'day' : 'days'}</Pill>
      </View>
      {listings.length ? (
        <ResponsiveGrid columns={layout.cardColumns} gap={14}>
          {listings.map((listing) => {
            const vehicle = listing.vehicle || {};
            const hostTotal = Number(listing.pricePerDay || 0) * days;
            const total = round2(hostTotal * (1 + feePercent / 100));
            const photo = imageUrl(vehicle.images?.[0]);
            return (
              <Surface key={listing.id} style={styles.listingCard}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" accessibilityLabel={`${vehicle.make || ''} ${vehicle.model || ''}`} />
                ) : (
                  <View style={styles.vehicleVisual}><Text style={styles.vehicleGlyph}>P&S</Text></View>
                )}
                <Text style={styles.vehicleName}>{vehicle.make || 'Vehicle'} {vehicle.model || ''}</Text>
                <View style={styles.metaRow}>
                  <Pill tone="blue">{listing.location || 'Local pickup'}</Pill>
                  {!!vehicle.seats && <Pill>{vehicle.seats} seats</Pill>}
                  {!!vehicle.fuelType && <Pill>{vehicle.fuelType}</Pill>}
                </View>
                <Text style={styles.price}>{rupees(listing.pricePerDay)}/day</Text>
                <Text style={styles.total}>{rupees(total)} for {days} {days === 1 ? 'day' : 'days'}, incl. {feePercent}% service fee</Text>
                {termsFor?.id === listing.id ? (
                  <View style={styles.terms}>
                    <Text style={styles.termsTitle}>Rental Terms</Text>
                    <Text style={styles.termsText}>
                      Before your first booking, please read and accept the PickAndSync Rental Terms. You only need to do this once.
                    </Text>
                    <AppButton variant="ghost" onPress={() => Linking.openURL(`${WEBSITE_URL}/terms`)}>Read the full terms</AppButton>
                    <AppButton onPress={acceptAndBook}>Accept and request booking</AppButton>
                    <AppButton variant="ghost" onPress={() => setTermsFor(null)}>Not now</AppButton>
                  </View>
                ) : (
                  <AppButton onPress={() => book(listing)} disabled={bookedId === listing.id}>{bookedId === listing.id ? 'Request sent' : 'Request Booking'}</AppButton>
                )}
                {feedback?.id === listing.id && (
                  <>
                    <Notice tone={feedback.tone}>{feedback.text}</Notice>
                    {needsVerification && (
                      <AppButton variant="ghost" onPress={() => Linking.openURL(`${WEBSITE_URL}/verify`)}>Verify your ID on the website</AppButton>
                    )}
                    {bookedId === listing.id && <AppButton variant="ghost" onPress={() => setTab('Bookings')}>Go to My Bookings</AppButton>}
                  </>
                )}
              </Surface>
            );
          })}
        </ResponsiveGrid>
      ) : (
        <Surface style={styles.empty}>
          <Text style={styles.emptyTitle}>No vehicles loaded yet</Text>
          <Text style={styles.emptyText}>Search a city, or publish your own car or bike from the Host screen.</Text>
          <AppButton variant="ghost" onPress={() => setTab('Host')}>Host a Vehicle</AppButton>
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchPanel: { marginBottom: 25 },
  searchButtonWrap: { flex: 1, justifyContent: 'flex-end', minHeight: 73 },
  terms: { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  termsTitle: { color: colors.navy, fontSize: 19, fontWeight: '900' },
  termsText: { color: colors.muted, lineHeight: 21, marginVertical: 8 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 14 },
  resultsEyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  resultsTitle: { color: colors.navy, fontSize: 22, fontWeight: '900', marginTop: 4 },
  listingCard: { minHeight: 310 },
  photo: { height: 150, borderRadius: 16, marginBottom: 15, backgroundColor: colors.blueSoft },
  vehicleVisual: { height: 88, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  vehicleGlyph: { color: colors.blue, fontWeight: '900', fontSize: 25, letterSpacing: -1 },
  vehicleName: { color: colors.navy, fontWeight: '900', fontSize: 20, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 },
  price: { color: colors.blue, fontWeight: '900', fontSize: 17 },
  total: { color: colors.muted, fontSize: 13, marginTop: 2, marginBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.muted, lineHeight: 21, textAlign: 'center', maxWidth: 470, marginVertical: 8 },
});
