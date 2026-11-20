import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { AppButton, DateStepper, EmptyState, Field, Icon, Notice, PageIntro, Pill, ResponsiveGrid, SectionHeader, SegmentedControl, SkeletonList, Surface, ToggleRow } from '../components/ui';
import { isValidDateRange, shortDate, today, tomorrow } from '../utils/dates';
import { errorFeedback, successFeedback } from '../utils/haptics';

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

const MODES = [
  { key: 'discover', label: 'Discover', icon: 'compass-outline' },
  { key: 'create', label: 'Create trip', icon: 'add-circle-outline' },
];

function Meta({ icon, children }) {
  return (
    <View style={styles.metaRow}>
      <Icon name={icon} size={14} color={colors.subtle} />
      <Text style={styles.metaText}>{children}</Text>
    </View>
  );
}

export default function TripsScreen({ user, setTab, layout, registerRefresh }) {
  const [mode, setMode] = useState('discover');
  const [form, setForm] = useState(defaultForm);
  const [trips, setTrips] = useState([]);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('gold');
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  const say = (text, nextTone = 'gold') => { setMessage(text); setTone(nextTone); };

  const loadTrips = useCallback(async () => {
    try {
      const response = await api.get('/trips', { status: 'OPEN', limit: 8 });
      setTrips(response.data || []);
    } catch (error) {
      say(error.message, 'error');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadTrips(); }, [loadTrips]);
  useEffect(() => registerRefresh?.(loadTrips), [registerRefresh, loadTrips]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeStart = (next) => setForm((current) => ({
    ...current,
    startDate: next,
    endDate: current.endDate < next ? next : current.endDate,
  }));

  const isMine = (trip) => Boolean(user && trip.organizerId === user.id);

  // Organizers share a private invite link (friends join straight away); others share the trip.
  const shareTrip = async (trip) => {
    setBusyId(trip.id);
    try {
      let url = `${WEBSITE_URL}/trips/${trip.id}`;
      let text = `Check out this trip to ${trip.destination} on PickAndSync:`;
      if (isMine(trip)) {
        const res = await api.post(`/trips/${trip.id}/invite`, {});
        url = res.data?.shareUrl || res.data?.url || url;
        text = `Join my trip "${trip.title}" to ${trip.destination} on PickAndSync — tap to join:`;
      } else {
        const res = await api.get(`/trips/${trip.id}`).catch(() => null);
        url = res?.data?.shareUrl || url;
      }
      await Share.share({ message: `${text} ${url}`, title: trip.title });
    } catch (error) {
      say(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const joinTrip = async (trip) => {
    if (!user) {
      say('Sign in first, then you can join a trip.');
      setTab('Account');
      return;
    }
    setBusyId(trip.id);
    say('');
    setNeedsVerification(false);
    try {
      const res = await api.post(`/trips/${trip.id}/join`, {});
      successFeedback();
      say(res.approved ? `You joined ${trip.title}.` : `Request sent. The organizer of ${trip.title} will review it.`, 'success');
    } catch (error) {
      if (/verif|aadhaar|licen[cs]e|kyc/i.test(error.message)) setNeedsVerification(true);
      errorFeedback();
      say(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const createTrip = async () => {
    if (!user) {
      say('Sign in first, then you can create a trip.');
      setTab('Account');
      return;
    }
    if (!form.title.trim() || !form.destination.trim()) {
      errorFeedback();
      say('Trip title and destination are required.', 'error');
      return;
    }
    if (!isValidDateRange(form.startDate, form.endDate)) {
      errorFeedback();
      say('Choose a valid start and end date.', 'error');
      return;
    }

    setCreating(true);
    say('');
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
      setForm(defaultForm);
      setMode('discover');
      setTrips((current) => [response.data, ...current].filter(Boolean));
      await loadTrips();
      successFeedback();
      say('Trip created. Tap Invite friends on it to share a private join link.', 'success');
    } catch (error) {
      errorFeedback();
      say(error.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View>
      <PageIntro
        eyebrow="GROUP TRIPS"
        icon="people"
        title="Travel together, plan together."
        description="Join an open trip or start your own and invite friends with one link."
        layout={layout}
      />

      <SegmentedControl options={MODES} value={mode} onChange={setMode} />

      {mode === 'create' ? (
        <Surface style={styles.createPanel}>
          <SectionHeader title="Trip details" subtitle="Everything here can be changed later on the website." />
          <ResponsiveGrid columns={layout.formColumns} gap={12}>
            <Field label="TRIP TITLE" icon="flag-outline" value={form.title} onChangeText={(value) => updateForm('title', value)} placeholder="Weekend in Manali" />
            <Field label="DESTINATION" icon="location-outline" value={form.destination} onChangeText={(value) => updateForm('destination', value)} placeholder="Manali" autoCapitalize="words" />
            <DateStepper label="STARTS" value={form.startDate} min={today} onChange={changeStart} />
            <DateStepper label="ENDS" value={form.endDate} min={form.startDate} onChange={(value) => updateForm('endDate', value)} />
            <Field label="MAX PEOPLE" icon="people-outline" value={form.maxParticipants} onChangeText={(value) => updateForm('maxParticipants', value.replace(/\D/g, ''))} placeholder="6" keyboardType="number-pad" maxLength={3} />
            <Field label="BUDGET PER PERSON (₹)" icon="cash-outline" value={form.budgetEstimate} onChangeText={(value) => updateForm('budgetEstimate', value.replace(/\D/g, ''))} placeholder="12000" keyboardType="number-pad" maxLength={7} />
          </ResponsiveGrid>
          <Field label="MEETING POINT" icon="navigate-outline" value={form.meetingPoint} onChangeText={(value) => updateForm('meetingPoint', value)} placeholder="City centre, metro station, cafe..." />
          <Field label="DESCRIPTION" value={form.description} onChangeText={(value) => updateForm('description', value)} placeholder="Tell travellers what to expect" multiline />
          <ToggleRow
            icon={form.isPublic ? 'globe-outline' : 'lock-closed-outline'}
            title={form.isPublic ? 'Public trip' : 'Private, invite-only'}
            subtitle={form.isPublic ? 'Anyone can find it and ask to join.' : 'Only people with your invite link can join.'}
            value={form.isPublic}
            onValueChange={(value) => updateForm('isPublic', value)}
          />
          <AppButton icon="rocket-outline" onPress={createTrip} loading={creating}>{creating ? 'Creating…' : 'Create Trip'}</AppButton>
          <Notice tone={tone}>{message}</Notice>
        </Surface>
      ) : (
        <>
          <SectionHeader title="Open trips" subtitle="Public trips looking for travellers." actionLabel="New trip" actionIcon="add" onAction={() => setMode('create')} />
          <Notice tone={tone}>{message}</Notice>
          {needsVerification && (
            <AppButton variant="ghost" icon="shield-checkmark-outline" onPress={() => Linking.openURL(`${WEBSITE_URL}/verify`)}>Verify your ID on the website</AppButton>
          )}
          {!loaded ? (
            <Surface style={styles.listGap}><SkeletonList rows={3} /></Surface>
          ) : trips.length ? (
            <ResponsiveGrid columns={layout.cardColumns} gap={14} style={styles.listGap}>
              {trips.map((trip) => {
                const going = trip._count?.members;
                const mine = isMine(trip);
                return (
                  <Surface key={trip.id} style={styles.tripCard}>
                    <View style={styles.tripTop}>
                      <Pill tone={mine ? 'gold' : 'green'} icon={mine ? 'star' : 'radio-button-on'}>{mine ? 'Your trip' : 'Open'}</Pill>
                      {!trip.isPublic && <Pill tone="gray" icon="lock-closed-outline">Private</Pill>}
                    </View>
                    <Text style={styles.tripTitle}>{trip.title}</Text>
                    <View style={styles.destination}>
                      <Icon name="location" size={16} color={colors.blueDark} />
                      <Text style={styles.destinationText}>{trip.destination}</Text>
                    </View>
                    {!!trip.description && <Text numberOfLines={3} style={styles.tripText}>{trip.description}</Text>}
                    <View style={styles.metaGrid}>
                      <Meta icon="calendar-outline">
                        {shortDate(trip.startDate)}{trip.endDate && String(trip.endDate).slice(0, 10) !== String(trip.startDate).slice(0, 10) ? ` → ${shortDate(trip.endDate)}` : ''}
                      </Meta>
                      <Meta icon="people-outline">{Number.isFinite(going) ? `${going} of ${trip.maxParticipants || 6} going` : `Up to ${trip.maxParticipants || 6} people`}</Meta>
                      {!!trip.budgetEstimate && <Meta icon="cash-outline">{rupees(trip.budgetEstimate)} per person</Meta>}
                    </View>
                    <View style={styles.tripActions}>
                      {!mine && (
                        <AppButton compact icon="person-add-outline" loading={busyId === trip.id} onPress={() => joinTrip(trip)} style={styles.flex}>Join</AppButton>
                      )}
                      <AppButton compact variant={mine ? 'primary' : 'ghost'} icon={mine ? 'paper-plane-outline' : 'share-social-outline'} disabled={busyId === trip.id} onPress={() => shareTrip(trip)} style={styles.flex}>
                        {mine ? 'Invite friends' : 'Share'}
                      </AppButton>
                    </View>
                  </Surface>
                );
              })}
            </ResponsiveGrid>
          ) : (
            <Surface style={styles.listGap}>
              <EmptyState icon="map-outline" title="No open trips yet" text="Start the first one, then invite friends with a link." actionLabel="Create a trip" actionIcon="add-circle-outline" onAction={() => setMode('create')} />
            </Surface>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  createPanel: { marginBottom: 18 },
  listGap: { marginTop: 6 },
  tripCard: { minHeight: 200 },
  tripTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tripTitle: { color: colors.navy, fontSize: 20, fontWeight: '900' },
  destination: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, marginBottom: 8 },
  destinationText: { color: colors.blueDark, fontSize: 15, fontWeight: '800' },
  tripText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  metaGrid: { gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { color: colors.navySoft, fontSize: 13, fontWeight: '700' },
  tripActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
});
