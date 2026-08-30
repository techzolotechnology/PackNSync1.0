import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme';
import { AppButton } from './ui';

const desktopNav = [
  ['Home', 'Travel Together'],
  ['Rentals', 'Cars & Bikes'],
  ['Host', 'Host a Vehicle'],
];

export default function AppHeader({ activeTab, setTab, layout }) {
  return (
    <View style={styles.header}>
      <View style={[styles.inner, { maxWidth: layout.contentMaxWidth, paddingHorizontal: layout.gutter }]}>
        <TouchableOpacity style={styles.brand} onPress={() => setTab('Home')} activeOpacity={0.8}>
          <Image source={require('../../assets/icon.png')} style={styles.brandIcon} />
          <View>
            <Text style={[styles.logo, layout.compact && styles.logoCompact]}>PickAndSync</Text>
            {!layout.compact && <Text style={styles.tagline}>Travel together, better</Text>}
          </View>
        </TouchableOpacity>

        {layout.tablet ? (
          <View style={styles.desktopActions}>
            <View style={styles.desktopNav}>
              {desktopNav.map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setTab(key)} style={styles.navItem}>
                  <Text style={[styles.navText, activeTab === key && styles.navTextActive]}>{label}</Text>
                  {activeTab === key && <View style={styles.navUnderline} />}
                </TouchableOpacity>
              ))}
            </View>
            <AppButton compact onPress={() => setTab('Account')}>Sync In</AppButton>
          </View>
        ) : (
          <AppButton compact onPress={() => setTab('Account')} style={layout.compact && styles.compactButton}>
            Sync In
          </AppButton>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: colors.blueDark,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 10,
  },
  inner: { width: '100%', alignSelf: 'center', minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  brandIcon: { width: 40, height: 40, borderRadius: 11 },
  logo: { color: colors.navy, fontWeight: '900', fontSize: 22, letterSpacing: -0.5 },
  logoCompact: { fontSize: 19 },
  tagline: { color: colors.subtle, fontWeight: '700', fontSize: 10, marginTop: 1 },
  desktopActions: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  desktopNav: { flexDirection: 'row', alignItems: 'stretch', gap: 18 },
  navItem: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 5 },
  navText: { color: colors.subtle, fontWeight: '700', fontSize: 14 },
  navTextActive: { color: colors.blue },
  navUnderline: { position: 'absolute', height: 2, backgroundColor: colors.blue, left: 4, right: 4, bottom: 4, borderRadius: 2 },
  compactButton: { minWidth: 76, paddingHorizontal: 13 },
});

