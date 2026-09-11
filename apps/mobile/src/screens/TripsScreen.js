import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../api';
import { colors } from '../theme';
import { AppButton, Field, Notice, PageIntro, Pill, ResponsiveGrid, Surface } from '../components/ui';
import { isValidDateRange, today, tomorrow } from '../utils/dates';

const defaultForm = {
  title: '',
  destination: '',
  startDate: today,
  endDate: tomorrow,
  maxParticipants: '6',
  budgetEstimate: '',
  meetingPoint: '',
  description: '',
  isPublic: true,
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TripsScreen({ user, setTab, layout }) {
  const [mode, setMode] = useState('discover');
  const [form, setForm] = useState(defaultForm);
  const [trips, setTrips] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const visibleTrips = useMemo(() => trips.slice(0, layout.tablet ? 6 : 4), [trips, layout.tablet]);

  const loadTrips = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await api.get('/trips', { status: 'OPEN', limit: 8 });
      setTrips(response.data || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const createTrip = async () => {
    if (!user) {
      setMessage('Login first, then you can create a trip.');
      setTab('Account');
      return;
    }
    if (!form.title.trim() || !form.destination.trim()) {
      setMessage('Trip title and destination are required.');
      return;
    }
    if (!isValidDateRange(form.startDate, form.endDate)) {
      setMessage('Choose a valid start and end date.');
      return;
    }

    setCreating(true);
    setMessage('');
    try {
      const descriptionParts = [form.description.trim()];
      if (form.meetingPoint.trim()) descriptionParts.push(`Meeting point: ${form.meetingPoint.trim()}`);
      const response = await api.post('/trips', {
        title: form.title.trim(),
        destination: form.destination.trim(),
        description: descriptionParts.filter(Boolean).join('\n\n') || null,
        startDate: form.startDate,
        endDate: form.endDate,
        maxParticipants: Number(form.maxParticipants) || 6,
        budgetEstimate: form.budgetEstimate ? Number(form.budgetEstimate) : null,
        isPublic: form.isPublic,
        coverImageUrl: null,
      });
      setMessage('Trip created. It is now available on the website for users to join.');
      setForm(defaultForm);
      setMode('discover');
      setTrips((current) => [response.data, ...current].filter(Boolean));
      loadTrips();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View>
      <PageIntro
        eyebrow="TRIPS"
        title="Create and discover group trips."
        description="Post a trip from the app and it uses the same PickAndSync backend as the website."
        layout={layout}
      />

      <View style={styles.switcher}>
        <AppButton compact style={styles.switchButton} variant={mode === 'discover' ? 'primary' : 'ghost'} onPress={() => setMode('discover')}>Discover</AppButton>
        <AppButton compact style={styles.switchButton} variant={mode === 'create' ? 'primary' : 'ghost'} onPress={() => setMode('create')}>Create Trip</AppButton>
      </View>

      {mode === 'create' ? (
        <Surface style={styles.createPanel}>
          <ResponsiveGrid columns={layout.formColumns} gap={12}>
            <Field label="TRIP TITLE" value={form.title} onChangeText={(value) => updateForm('title', value)} placeholder="Weekend in Manali" />
            <Field label="DESTINATION" value={form.destination} onChangeText={(value) => updateForm('destination', value)} placeholder="Manali" autoCapitalize="words" />
            <Field label="START DATE" value={form.startDate} onChangeText={(value) => updateForm('startDate', value)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            <Field label="END DATE" value={form.endDate} onChangeText={(value) => updateForm('endDate', value)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            <Field label="MAX PEOPLE" value={form.maxParticipants} onChangeText={(value) => updateForm('maxParticipants', value)} placeholder="6" keyboardType="number-pad" />
            <Field label="BUDGET ESTIMATE" value={form.budgetEstimate} onChangeText={(value) => updateForm('budgetEstimate', value)} placeholder="12000" keyboardType="number-pad" />
          </ResponsiveGrid>
          <Field label="MEETING POINT" value={form.meetingPoint} onChangeText={(value) => updateForm('meetingPoint', value)} placeholder="City center, metro station, cafe..." />
          <Field label="DESCRIPTION" value={form.description} onChangeText={(value) => updateForm('description', value)} placeholder="Tell travelers what to expect" multiline />
          <View style={styles.publicRow}>
            <Text style={styles.publicText}>{form.isPublic ? 'Public on website' : 'Private invite-only trip'}</Text>
            <AppButton compact variant="ghost" onPress={() => updateForm('isPublic', !form.isPublic)}>
              {form.isPublic ? 'Make Private' : 'Make Public'}
            </AppButton>
          </View>
          <AppButton onPress={createTrip} disabled={creating}>{creating ? 'Creating...' : 'Create Trip'}</AppButton>
          <Notice>{message}</Notice>
        </Surface>
      ) : (
        <>
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>{loading ? 'Loading trips...' : 'Open trips from PickAndSync'}</Text>
            <AppButton compact variant="ghost" onPress={loadTrips}>Refresh</AppButton>
          </View>
          <ResponsiveGrid columns={layout.cardColumns} gap={14}>
            {visibleTrips.map((trip) => (
              <Surface key={trip.id} style={styles.tripCard}>
                <View style={styles.tripTop}>
                  <Pill tone="blue">{trip.status || 'OPEN'}</Pill>
                  <Text style={styles.tripDate}>{formatDate(trip.startDate)}</Text>
                </View>
                <Text style={styles.tripTitle}>{trip.title}</Text>
                <Text style={styles.tripDestination}>{trip.destination}</Text>
                {!!trip.description && <Text numberOfLines={3} style={styles.tripText}>{trip.description}</Text>}
                <Text style={styles.tripMeta}>
                  Up to {trip.maxParticipants || 6} people
                  {trip.budgetEstimate ? ` - Rs ${Number(trip.budgetEstimate).toLocaleString('en-IN')} budget` : ''}
                </Text>
              </Surface>
            ))}
          </ResponsiveGrid>
          {!visibleTrips.length && !loading && (
            <Surface style={styles.empty}>
              <Text style={styles.emptyTitle}>No public trips loaded yet</Text>
              <Text style={styles.emptyText}>Create the first trip from the app, then people can join it from the website.</Text>
              <AppButton onPress={() => setMode('create')}>Create Trip</AppButton>
            </Surface>
          )}
          <Notice>{message}</Notice>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  switchButton: { flex: 1 },
  createPanel: { marginBottom: 18 },
  publicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  publicText: { color: colors.navy, fontWeight: '800', flex: 1 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  listTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', flex: 1 },
  tripCard: { minHeight: 210 },
  tripTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 },
  tripDate: { color: colors.subtle, fontSize: 12, fontWeight: '800' },
  tripTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', marginBottom: 5 },
  tripDestination: { color: colors.blueDark, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  tripText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  tripMeta: { color: colors.subtle, fontSize: 13, fontWeight: '700', marginTop: 'auto' },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.muted, lineHeight: 21, textAlign: 'center', maxWidth: 470, marginVertical: 8 },
});
