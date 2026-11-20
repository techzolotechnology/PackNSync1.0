import React, { useCallback, useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { colors, shadows } from '../theme';
import { AppButton, Icon, Pill, PressableScale, Surface } from '../components/ui';
import { shortDate } from '../utils/dates';
import { openHostApp } from '../utils/hostApp';

const ROUTE_STOPS = [
  { key: 'start', label: 'Start', left: '17%', top: '43%' },
  { key: 'middle', label: 'Along the way', left: '49%', top: '50%' },
  { key: 'finish', label: 'Destination', left: '76%', top: '40%' },
];

function RouteStop({ stop, index, active, onPress }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`Select route ${stop.label}`}
      accessibilityState={{ selected: active }}
      style={[styles.stop, { left: stop.left, top: stop.top }, active && styles.stopActive]}
    >
      <Text style={[styles.stopNumber, active && styles.stopNumberActive]}>{index + 1}</Text>
    </PressableScale>
  );
}

export default function HomeScreen({ layout, setTab, launchTripComposer, registerRefresh }) {
  const [featuredTrip, setFeaturedTrip] = useState(null);
  const [selectedStop, setSelectedStop] = useState(0);
  const mapHeight = Math.max(210, Math.min((layout.width - 2 * layout.gutter) * 0.62, 380));

  const loadFeaturedTrip = useCallback(async () => {
    const response = await api.get('/trips', { status: 'OPEN', limit: 1 }).catch(() => null);
    setFeaturedTrip(response?.data?.[0] || null);
  }, []);

  useEffect(() => { loadFeaturedTrip(); }, [loadFeaturedTrip]);
  useEffect(() => registerRefresh?.(loadFeaturedTrip), [registerRefresh, loadFeaturedTrip]);

  const startDate = featuredTrip?.startDate ? shortDate(featuredTrip.startDate) : null;

  return (
    <View style={[styles.screen, { gap: layout.sectionGap }]}>
      <View style={[styles.hero, { padding: layout.compact ? 13 : 16 }]}>
        <View style={styles.intro}>
          <View style={styles.brandLine}>
            <Pill tone="gold" icon="people-outline">TRAVEL TOGETHER</Pill>
          </View>
          <Text style={[styles.title, { fontSize: layout.headingSize, lineHeight: layout.headingSize * 1.08 }]}>Make the next trip a group plan.</Text>
          <Text style={styles.subtitle}>Plan together, find a ride, and keep the journey in sync.</Text>
        </View>

        <View style={[styles.mapCard, { height: mapHeight }]}>
          <ImageBackground
            source={require('../../assets/home-trip-diorama.jpg')}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            imageStyle={styles.mapImage}
            accessibilityLabel="Three-dimensional miniature travel route map"
          >
            <View style={styles.mapTag}>
              <Icon name="cube-outline" size={14} color={colors.blueDark} />
              <Text style={styles.mapTagText}>YOUR TRIP, IN 3D</Text>
            </View>
            {ROUTE_STOPS.map((stop, index) => (
              <RouteStop key={stop.key} stop={stop} index={index} active={selectedStop === index} onPress={() => setSelectedStop(index)} />
            ))}
            <View style={styles.routeCaption}>
              <Icon name="location" size={15} color={colors.blue} />
              <Text style={styles.routeCaptionText}>{ROUTE_STOPS[selectedStop].label}</Text>
            </View>
          </ImageBackground>
        </View>
      </View>

      <Surface style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <Pill tone="blue" icon="people-outline">GROUP TRIP</Pill>
          <Icon name="sparkles-outline" size={19} color={colors.goldText} />
        </View>
        {featuredTrip ? (
          <>
            <Text style={styles.tripTitle} numberOfLines={2}>{featuredTrip.title}</Text>
            <View style={styles.tripMeta}>
              <Icon name="location-outline" size={16} color={colors.blue} />
              <Text style={styles.tripMetaText} numberOfLines={1}>{featuredTrip.destination}</Text>
              {startDate ? <Text style={styles.tripDate}>{startDate}</Text> : null}
            </View>
            {!!featuredTrip.budgetEstimate && (
              <PressableScale onPress={() => setTab('Trips')} accessibilityLabel="Open group trips and shared budget" style={styles.budgetRow}>
                <View style={styles.budgetIcon}><Icon name="pie-chart-outline" size={20} color={colors.blue} /></View>
                <View style={styles.budgetCopy}>
                  <Text style={styles.budgetTitle}>Shared trip budget</Text>
                  <Text style={styles.budgetSubtitle}>{rupees(featuredTrip.budgetEstimate)} per person</Text>
                </View>
                <Icon name="chevron-forward" size={19} color={colors.subtle} />
              </PressableScale>
            )}
          </>
        ) : (
          <>
            <Text style={styles.tripTitle}>Your next trip starts here.</Text>
            <Text style={styles.tripEmptyText}>Choose a destination and invite your crew to plan it together.</Text>
          </>
        )}
        <AppButton variant="ghost" compact icon="map-outline" iconRight="arrow-forward" onPress={() => setTab('Trips')}>
          {featuredTrip ? 'Explore group trips' : 'See open trips'}
        </AppButton>
      </Surface>

      {!featuredTrip?.budgetEstimate && (
        <Surface onPress={() => setTab('Trips')} style={styles.sharedRow}>
          <View style={styles.sharedIcon}><Icon name="pie-chart" size={22} color={colors.blue} /></View>
          <View style={styles.sharedCopy}>
            <Text style={styles.sharedTitle}>Plan the budget together</Text>
            <Text style={styles.sharedSubtitle}>Set a clear per-person trip budget.</Text>
          </View>
          <Icon name="chevron-forward" size={19} color={colors.subtle} />
        </Surface>
      )}

      <View style={styles.actions}>
        <AppButton icon="add-circle-outline" onPress={launchTripComposer || (() => setTab('Trips'))}>Start a trip</AppButton>
        <AppButton variant="soft" icon="car-sport-outline" iconRight="arrow-forward" onPress={() => setTab('Rentals')}>Find a ride</AppButton>
        <AppButton variant="ghost" icon="key-outline" iconRight="open-outline" onPress={openHostApp}>Host a vehicle</AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { width: '100%' },
  hero: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 13, backgroundColor: colors.blue, borderRadius: 28, overflow: 'hidden' },
  intro: { gap: 9 },
  brandLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  title: { color: colors.white, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: '#e5f1ff', fontSize: 15, lineHeight: 22 },
  mapCard: { width: '100%', overflow: 'hidden', borderRadius: 21, backgroundColor: colors.blueSoft, ...shadows.card },
  mapImage: { borderRadius: 21 },
  mapTag: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.94)', paddingVertical: 6, paddingHorizontal: 9 },
  mapTagText: { color: colors.blueDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  stop: { position: 'absolute', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, backgroundColor: colors.gold, elevation: 5, ...shadows.button },
  stopActive: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blue, borderColor: colors.gold },
  stopNumber: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  stopNumberActive: { color: colors.white },
  routeCaption: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 10 },
  routeCaptionText: { color: colors.navy, fontSize: 12, fontWeight: '800' },
  tripCard: { padding: 15, gap: 10 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tripTitle: { color: colors.navy, fontSize: 21, lineHeight: 27, fontWeight: '900' },
  tripMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tripMetaText: { flexShrink: 1, color: colors.muted, fontSize: 14, fontWeight: '700' },
  tripDate: { color: colors.subtle, fontSize: 12 },
  tripEmptyText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.bluePale },
  budgetIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  budgetCopy: { flex: 1, minWidth: 0 },
  budgetTitle: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  budgetSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  sharedIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bluePale },
  sharedCopy: { flex: 1, minWidth: 0 },
  sharedTitle: { color: colors.navy, fontWeight: '900', fontSize: 15 },
  sharedSubtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  actions: { gap: 9 },
});
