import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../api';
import { colors } from '../theme';
import { AppButton, Field, Notice, PageIntro, Pill, ResponsiveGrid, Surface } from '../components/ui';
import { rentalDays, today, tomorrow } from '../utils/dates';

export default function RentalsScreen({ user, setTab, layout }) {
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [listings, setListings] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const days = useMemo(() => rentalDays(startDate, endDate), [startDate, endDate]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await api.get('/rentals/listings', { location, startDate, endDate });
      setListings(response.data || []);
    } catch (error) {
      setMessage(error.message);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const book = async (listing) => {
    if (!user) return setTab('Account');
    try {
      await api.post('/rentals/bookings', { listingId: listing.id, startDate, endDate });
      setMessage(`Booking request sent. Total ₹${Number(listing.pricePerDay || 0) * days}`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <View>
      <PageIntro eyebrow="CARS & BIKES" title="Pick your next ride." description="Search local self-drive vehicles using the same PickAndSync account and shared backend as the website." layout={layout} />
      <Surface style={styles.searchPanel}>
        <ResponsiveGrid columns={layout.formColumns} gap={12}>
          <Field label="PICKUP CITY" value={location} onChangeText={setLocation} placeholder="Bangalore" autoCapitalize="words" />
          <Field label="START DATE" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <Field label="END DATE" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <View style={styles.searchButtonWrap}><AppButton onPress={load} disabled={loading}>{loading ? 'Searching…' : 'Search Cars & Bikes'}</AppButton></View>
        </ResponsiveGrid>
        <Notice>{message}</Notice>
      </Surface>
      <View style={styles.resultsHeader}>
        <View><Text style={styles.resultsEyebrow}>AVAILABLE NEARBY</Text><Text style={styles.resultsTitle}>{listings.length ? `${listings.length} vehicles found` : 'Explore local wheels'}</Text></View>
        <Pill tone="blue">{days} {days === 1 ? 'day' : 'days'}</Pill>
      </View>
      {listings.length ? (
        <ResponsiveGrid columns={layout.cardColumns} gap={14}>
          {listings.map((listing) => {
            const vehicle = listing.vehicle || {};
            const total = Number(listing.pricePerDay || 0) * days;
            return (
              <Surface key={listing.id} style={styles.listingCard}>
                <View style={styles.vehicleVisual}><Text style={styles.vehicleGlyph}>P&S</Text></View>
                <Text style={styles.vehicleName}>{vehicle.make || 'Vehicle'} {vehicle.model || ''}</Text>
                <View style={styles.metaRow}>
                  <Pill tone="blue">{listing.location || 'Local pickup'}</Pill>
                  {!!vehicle.seats && <Pill>{vehicle.seats} seats</Pill>}
                  {!!vehicle.fuelType && <Pill>{vehicle.fuelType}</Pill>}
                </View>
                <Text style={styles.price}>₹{listing.pricePerDay}/day <Text style={styles.total}>• ₹{total} total</Text></Text>
                <AppButton onPress={() => book(listing)}>Request Booking</AppButton>
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
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 14 },
  resultsEyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  resultsTitle: { color: colors.navy, fontSize: 22, fontWeight: '900', marginTop: 4 },
  listingCard: { minHeight: 310 },
  vehicleVisual: { height: 88, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  vehicleGlyph: { color: colors.blue, fontWeight: '900', fontSize: 25, letterSpacing: -1 },
  vehicleName: { color: colors.navy, fontWeight: '900', fontSize: 20, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 },
  price: { color: colors.blue, fontWeight: '900', fontSize: 17, marginBottom: 8 },
  total: { color: colors.muted, fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.muted, lineHeight: 21, textAlign: 'center', maxWidth: 470, marginVertical: 8 },
});
