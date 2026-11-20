import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { rupees } from '../api';
import { colors, createLayout, shadows } from '../theme';
import { AppButton, Chip, Field, Icon, Notice, PageIntro, Surface } from '../components/ui';
import RentalMapCanvas from './RentalMapCanvas';

const titleFor = (listing) => `${listing.vehicle?.make || 'Vehicle'} ${listing.vehicle?.model || ''}`.trim();

export default function RentalMapScreen({ listings, location, kind, loading, loadingMore, total, hasMore, onSearch, onReturn, onLoadMore, onBook }) {
  const { width, height, fontScale } = useWindowDimensions();
  const layout = useMemo(() => createLayout(width, height, fontScale), [width, height, fontScale]);
  const [mapLocation, setMapLocation] = useState(location);
  const [mapKind, setMapKind] = useState(kind);
  const [selected, setSelected] = useState(null);
  const mapHeight = Math.max(320, Math.min(Math.round(height * 0.54), 560));
  const points = listings.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

  useEffect(() => { setMapLocation(location); }, [location]);
  useEffect(() => { setMapKind(kind); }, [kind]);
  useEffect(() => {
    setSelected((current) => listings.find((item) => item.id === current?.id) || listings.find((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) || null);
  }, [listings]);

  const updateKind = (next) => {
    setMapKind(next);
    onSearch({ location: mapLocation, kind: next });
  };

  return (
    <View>
      <PageIntro eyebrow="EXPLORE BY MAP" icon="map" title="Find your next ride." description="See available cars and bikes around your pickup area. Pins show an approximate area, not an exact address." layout={layout} />
      <Surface style={styles.filters}>
        <View style={styles.filtersTop}>
          <View style={styles.filtersTitle}><Icon name="options-outline" color={colors.blue} /><Text style={styles.title}>Map filters</Text></View>
          <AppButton variant="ghost" compact icon="list-outline" onPress={onReturn}>List</AppButton>
        </View>
        <View style={styles.chips}>
          <Chip label="All vehicles" active={mapKind === 'all'} icon="apps-outline" onPress={() => updateKind('all')} />
          <Chip label="Cars" active={mapKind === 'car'} icon="car-sport-outline" onPress={() => updateKind('car')} />
          <Chip label="Bikes" active={mapKind === 'bike'} icon="bicycle-outline" onPress={() => updateKind('bike')} />
        </View>
        <Field label="PICKUP AREA" icon="location-outline" value={mapLocation} onChangeText={setMapLocation} placeholder="Search a city, e.g. Bengaluru" autoCapitalize="words" returnKeyType="search" onSubmitEditing={() => onSearch({ location: mapLocation, kind: mapKind })} />
        <AppButton variant="soft" icon="search-outline" onPress={() => onSearch({ location: mapLocation, kind: mapKind })} loading={loading}>Update map</AppButton>
      </Surface>

      <View style={[styles.mapFrame, { height: mapHeight }]}>
        <RentalMapCanvas listings={listings} selectedId={selected?.id} onSelect={setSelected} height={mapHeight} />
        <View pointerEvents="none" style={styles.mapBadge}>
          <Image source={require('../../assets/icon.png')} style={styles.badgeIcon} />
          <Text style={styles.mapBadgeText}>{total > points.length ? `${points.length} of ${total}` : `${points.length} nearby`}</Text>
        </View>
      </View>

      {!points.length && (
        <Notice tone="gold">Map locations aren’t available yet for these listings. The vehicle list is still available.</Notice>
      )}

      {selected && (
        <Surface style={styles.vehicleCard}>
          <View style={styles.cardTop}>
            <View style={styles.vehicleIcon}><Icon name={['BIKE', 'SCOOTER'].includes(String(selected.vehicle?.type || '').toUpperCase()) ? 'bicycle' : 'car-sport'} size={23} color={colors.blue} /></View>
            <View style={styles.vehicleText}>
              <Text style={styles.vehicleName} numberOfLines={2}>{titleFor(selected)}</Text>
              <View style={styles.approxRow}><Icon name="location" size={13} color={colors.blue} /><Text style={styles.approx}>Approximate pickup area</Text></View>
            </View>
            <Text style={styles.rate}>{rupees(selected.pricePerDay)}<Text style={styles.perDay}>/day</Text></Text>
          </View>
          <AppButton icon="calendar-outline" onPress={() => onBook(selected)}>Request this vehicle</AppButton>
        </Surface>
      )}

      {points.length > 1 && (
        <View style={styles.vehicleRail}>
          <Text style={styles.railTitle}>NEARBY VEHICLES</Text>
          {points.map((listing) => (
            <Chip key={listing.id} label={`${titleFor(listing)} · ${rupees(listing.pricePerDay)}`} active={selected?.id === listing.id} onPress={() => setSelected(listing)} />
          ))}
        </View>
      )}
      {hasMore && <AppButton variant="ghost" icon="chevron-down-outline" onPress={onLoadMore} loading={loadingMore} disabled={loading}>Load more vehicles on map</AppButton>}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { padding: 14, marginBottom: 12 },
  filtersTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 },
  filtersTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.navy, fontWeight: '900', fontSize: 17 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mapFrame: { width: '100%', overflow: 'hidden', borderRadius: 22, backgroundColor: colors.bluePale, marginBottom: 12, ...shadows.card },
  mapBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, backgroundColor: colors.white, paddingVertical: 6, paddingHorizontal: 10, elevation: 3 },
  badgeIcon: { width: 22, height: 22, borderRadius: 7 },
  mapBadgeText: { color: colors.navy, fontWeight: '800', fontSize: 12 },
  vehicleCard: { padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  vehicleIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.bluePale, alignItems: 'center', justifyContent: 'center' },
  vehicleText: { flex: 1, minWidth: 0 },
  vehicleName: { color: colors.navy, fontSize: 17, fontWeight: '900' },
  approxRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  approx: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  rate: { color: colors.blueDark, fontSize: 15, fontWeight: '900', flexShrink: 0 },
  perDay: { color: colors.muted, fontWeight: '700', fontSize: 11 },
  vehicleRail: { gap: 8, marginVertical: 8 },
  railTitle: { color: colors.blueDark, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
