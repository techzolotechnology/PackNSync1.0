import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/ui';
import { colors } from '../theme';

export default function RentalMapCanvas({ listings, height }) {
  const count = listings.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).length;
  return (
    <View style={[styles.fallback, { height }]}>
      <View style={styles.icon}><Icon name="map-outline" size={34} color={colors.blue} /></View>
      <Text style={styles.title}>Map preview is available in the mobile app</Text>
      <Text style={styles.copy}>{count ? `${count} vehicles have approximate map areas.` : 'Switch to a native Android or iPhone build to explore vehicle locations.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.bluePale, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 9 },
  icon: { width: 62, height: 62, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.navy, textAlign: 'center', fontSize: 18, fontWeight: '900' },
  copy: { color: colors.muted, textAlign: 'center', lineHeight: 21 },
});
