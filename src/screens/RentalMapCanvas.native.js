import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { Icon } from '../components/ui';
import { colors, shadows } from '../theme';
import { rupees } from '../api';

const APP_MARK = require('../../assets/icon.png');
const DEFAULT_REGION = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 18, longitudeDelta: 18 };

function VehicleMarker({ listing, selected, onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const vehicle = listing.vehicle || {};
  const twoWheeler = ['BIKE', 'SCOOTER'].includes(String(vehicle.type || '').toUpperCase());

  useEffect(() => {
    if (!selected) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 720, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 720, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, selected]);

  return (
    <Marker
      coordinate={{ latitude: listing.latitude, longitude: listing.longitude }}
      onPress={onPress}
      tracksViewChanges={selected}
      accessibilityLabel={`${vehicle.make || 'Vehicle'} ${vehicle.model || ''}, ${rupees(listing.pricePerDay)} per day`}
      zIndex={selected ? 10 : 1}
    >
      <View style={styles.markerWrap}>
        <Animated.View style={[styles.marker, selected && styles.markerSelected, { transform: [{ scale: pulse }] }]}>
          <View style={styles.brandMark}>
            <Image source={APP_MARK} style={styles.logo} />
          </View>
          <Icon name={twoWheeler ? 'bicycle' : 'car-sport'} size={16} color={selected ? colors.white : colors.navy} />
          <Text style={[styles.price, selected && styles.selectedPrice]}>{rupees(listing.pricePerDay)}</Text>
        </Animated.View>
        <View style={[styles.markerTip, selected && styles.markerTipSelected]} />
      </View>
    </Marker>
  );
}

export default function RentalMapCanvas({ listings, selectedId, onSelect, height }) {
  const mapRef = useRef(null);
  const points = listings.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  const first = points[0];
  const initialRegion = first
    ? { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.14, longitudeDelta: 0.14 }
    : DEFAULT_REGION;

  useEffect(() => {
    if (points.length < 2) return;
    mapRef.current?.fitToCoordinates(points.map(({ latitude, longitude }) => ({ latitude, longitude })), {
      edgePadding: { top: 64, right: 42, bottom: 56, left: 42 },
      animated: true,
    });
  }, [points.length]);

  return (
    <MapView
      ref={mapRef}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={initialRegion}
      style={{ height, width: '100%' }}
      showsCompass
      showsScale
      toolbarEnabled={false}
      nestedScrollEnabled
      accessibilityLabel="Map of available rental vehicles"
    >
      {points.map((listing) => (
        <VehicleMarker
          key={listing.id}
          listing={listing}
          selected={listing.id === selectedId}
          onPress={() => onSelect(listing)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  markerWrap: { alignItems: 'center' },
  marker: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  markerSelected: { backgroundColor: colors.blue, borderColor: colors.gold, elevation: 9 },
  brandMark: { width: 28, height: 28, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.blue },
  logo: { width: 28, height: 28 },
  price: { color: colors.navy, fontWeight: '900', fontSize: 12 },
  selectedPrice: { color: colors.white },
  markerTip: { width: 10, height: 10, marginTop: -6, transform: [{ rotate: '45deg' }], backgroundColor: colors.white },
  markerTipSelected: { backgroundColor: colors.blue },
});
