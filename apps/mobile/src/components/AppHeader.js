import React from 'react';
import { Image, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme';
import { AppButton, Icon, PressableScale } from './ui';

// Android draws the app under the status bar; keep the header below it (SafeAreaView only does this on iOS).
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

const desktopNav = [
  ['Home', 'Home', 'home'],
  ['Trips', 'Group Trips', 'people'],
  ['Rentals', 'Cars & Bikes', 'car-sport'],
  ['Bookings', 'My Bookings', 'calendar'],
  ['Wallet', 'Wallet', 'wallet'],
];

// Signed in: your initial opens the account page. Signed out: the Sync In button.
function AccountButton({ user, setTab, activeTab, compactStyle }) {
  if (!user) return <AppButton compact icon="log-in-outline" onPress={() => setTab('Account')} style={compactStyle}>Sync In</AppButton>;
  return (
    <PressableScale
      accessibilityLabel="Your account"
      onPress={() => setTab('Account')}
      scaleTo={0.9}
      style={[styles.avatar, activeTab === 'Account' && styles.avatarActive]}
    >
      <Text style={styles.avatarText}>{String(user.name || 'P').slice(0, 1).toUpperCase()}</Text>
    </PressableScale>
  );
}

export default function AppHeader({ activeTab, setTab, layout, user }) {
  return (
    <View style={[styles.header, { paddingTop: statusBarHeight }]}>
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
              {desktopNav.map(([key, label, icon]) => (
                <PressableScale key={key} onPress={() => setTab(key)} scaleTo={0.95} accessibilityRole="tab" accessibilityState={{ selected: activeTab === key }} style={styles.navItem}>
                  <Icon name={activeTab === key ? icon : `${icon}-outline`} size={17} color={activeTab === key ? colors.blue : colors.subtle} />
                  <Text style={[styles.navText, activeTab === key && styles.navTextActive]}>{label}</Text>
                  {activeTab === key && <View style={styles.navUnderline} />}
                </PressableScale>
              ))}
            </View>
            <AccountButton user={user} setTab={setTab} activeTab={activeTab} />
          </View>
        ) : (
          <AccountButton user={user} setTab={setTab} activeTab={activeTab} compactStyle={layout.compact && styles.compactButton} />
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
  desktopNav: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  navItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 5 },
  navText: { color: colors.subtle, fontWeight: '700', fontSize: 14 },
  navTextActive: { color: colors.blue },
  navUnderline: { position: 'absolute', height: 2, backgroundColor: colors.blue, left: 4, right: 4, bottom: 4, borderRadius: 2 },
  compactButton: { minWidth: 76, paddingHorizontal: 13 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft, borderWidth: 2, borderColor: 'transparent' },
  avatarActive: { borderColor: colors.blue },
  avatarText: { color: colors.blue, fontSize: 18, fontWeight: '900' },
});

