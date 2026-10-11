import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { colors } from '../theme';
import { Icon, IconCircle, ResponsiveGrid, Surface } from '../components/ui';

const quickActions = [
  { tab: 'Rentals', icon: 'car-sport', tone: 'blue', title: 'Find a ride', caption: 'Cars & bikes near you' },
  { tab: 'Trips', icon: 'people', tone: 'green', title: 'Group trips', caption: 'Join or start one' },
  { tab: 'Wallet', icon: 'wallet', tone: 'gold', title: 'Wallet', caption: 'Pay & add money' },
  { tab: 'Host', icon: 'key', tone: 'blue', title: 'Host & earn', caption: 'List your vehicle' },
];

const featureCards = [
  ['people-circle', 'Travel Together', 'Join group trips and keep every shared expense clear from the first plan to the final split.'],
  ['car-sport', 'Cars & Bikes', 'Find community-hosted wheels with simple dates, transparent pricing, and one familiar flow.'],
  ['shield-checkmark', 'Verified people', 'Hosts and renters verify their ID before booking, so you know who you are travelling with.'],
];

const highlights = [
  ['people-outline', 'Shared trips'],
  ['git-compare-outline', 'Split fairly'],
  ['location-outline', 'Local wheels'],
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ layout, setTab, user, registerRefresh }) {
  const [wallet, setWallet] = useState(null);

  const loadWallet = useCallback(async () => {
    if (!user) return setWallet(null);
    const res = await api.get('/wallet').catch(() => null);
    setWallet(res?.data || null);
  }, [user]);

  useEffect(() => { loadWallet(); }, [loadWallet]);
  useEffect(() => registerRefresh?.(loadWallet), [registerRefresh, loadWallet]);

  const firstName = String(user?.name || '').trim().split(/\s+/)[0];

  return (
    <View style={{ gap: layout.sectionGap }}>
      <View style={[styles.hero, { paddingHorizontal: layout.tablet ? 42 : layout.compact ? 16 : 22, paddingVertical: layout.tablet ? 42 : 26 }]}>
        <View style={styles.bubbleLarge} />
        <View style={styles.bubbleSmall} />
        <View style={styles.pinHalo}>
          <Image source={require('../../assets/pin.png')} resizeMode="contain" style={styles.pin} />
        </View>
        <Text style={styles.eyebrow}>{firstName ? `${greeting().toUpperCase()}, ${firstName.toUpperCase()}` : 'PICKANDSYNC'}</Text>
        <Text style={[styles.title, { fontSize: layout.heroTitleSize, lineHeight: layout.heroTitleSize * 1.08 }]}>
          {firstName ? 'Where to next?' : 'Travel together. Book wheels. Split fairly.'}
        </Text>
        <Text style={[styles.subtitle, layout.tablet && styles.subtitleTablet]}>
          Join group trips, rent community cars or bikes, and keep every cost clear — built for crews on the move.
        </Text>
      </View>

      <ResponsiveGrid columns={layout.tablet ? 4 : 2} gap={12}>
        {quickActions.map((action) => (
          <Surface key={action.tab} onPress={() => setTab(action.tab)} style={styles.tile}>
            <IconCircle name={action.icon} tone={action.tone} size={46} />
            <Text style={styles.tileTitle}>{action.title}</Text>
            <Text style={styles.tileCaption}>{action.caption}</Text>
          </Surface>
        ))}
      </ResponsiveGrid>

      {user && wallet && (
        <Surface onPress={() => setTab('Wallet')} style={styles.walletStrip}>
          <View style={styles.walletIcon}><Icon name="wallet" size={22} color={colors.white} /></View>
          <View style={styles.flex}>
            <Text style={styles.walletLabel}>Wallet balance</Text>
            <Text style={styles.walletAmount}>{rupees(wallet.balance)}</Text>
            {wallet.promoBalance > 0 && <Text style={styles.walletPromo}>+ {rupees(wallet.promoBalance)} promo credit to spend on rentals</Text>}
          </View>
          <Icon name="chevron-forward" size={20} color="#cfe6ff" />
        </Surface>
      )}

      <View style={styles.stats}>
        {highlights.map(([icon, label]) => (
          <View key={label} style={styles.stat}>
            <Icon name={icon} size={20} color={colors.blue} />
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View>
        <Text style={styles.sectionEyebrow}>ONE PLATFORM</Text>
        <Text style={[styles.sectionTitle, { fontSize: layout.headingSize }]}>Everything stays in sync.</Text>
        <ResponsiveGrid columns={layout.cardColumns} gap={14} style={styles.featureGrid}>
          {featureCards.map(([icon, title, description]) => (
            <Surface key={title} style={styles.featureCard}>
              <IconCircle name={icon} size={44} />
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.featureText}>{description}</Text>
            </Surface>
          ))}
        </ResponsiveGrid>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', backgroundColor: colors.blueSoft, borderColor: colors.blueBorder, borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
  bubbleLarge: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.45)', top: -90, right: -70 },
  bubbleSmall: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(0,123,255,0.08)', bottom: -40, left: -30 },
  pinHalo: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.78)', marginBottom: 12 },
  pin: { width: 54, height: 54 },
  eyebrow: { color: colors.blueDark, fontSize: 13, fontWeight: '900', letterSpacing: 1.3, marginBottom: 10, textAlign: 'center' },
  title: { color: colors.navy, fontWeight: '900', letterSpacing: -1.4, maxWidth: 850, textAlign: 'center' },
  subtitle: { color: colors.navySoft, fontSize: 16, lineHeight: 23, maxWidth: 700, marginTop: 12, textAlign: 'center' },
  subtitleTablet: { fontSize: 18, lineHeight: 27 },
  tile: { minHeight: 148, padding: 16 },
  tileTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginTop: 12 },
  tileCaption: { color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  walletStrip: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.blueDark, borderColor: colors.blueDark },
  walletIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  walletLabel: { color: '#cfe6ff', fontWeight: '800', fontSize: 12, letterSpacing: 0.6 },
  walletAmount: { color: colors.white, fontSize: 24, fontWeight: '900', marginTop: 2 },
  walletPromo: { color: '#e5f1ff', fontSize: 12, marginTop: 2, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 17, paddingVertical: 13, paddingHorizontal: 6, alignItems: 'center', gap: 5 },
  statLabel: { color: colors.navySoft, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  sectionEyebrow: { color: colors.blue, fontSize: 12, letterSpacing: 1.3, fontWeight: '900', marginTop: 6 },
  sectionTitle: { color: colors.navy, fontWeight: '900', letterSpacing: -0.8, marginTop: 5, marginBottom: 16 },
  featureGrid: { marginBottom: 6 },
  featureCard: { minHeight: 170 },
  featureTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', marginTop: 13, marginBottom: 6 },
  featureText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
