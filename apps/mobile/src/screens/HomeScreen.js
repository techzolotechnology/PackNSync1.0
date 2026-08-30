import React from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { AppButton, Pill, ResponsiveGrid, Surface } from '../components/ui';

const featureCards = [
  ['Travel Together', 'Join group trips and keep every shared expense clear from the first plan to the final split.'],
  ['Cars & Bikes', 'Find community-hosted wheels with simple dates, transparent pricing, and one familiar flow.'],
  ['Host a Vehicle', 'Publish your own car or bike and manage it from the same PickAndSync account.'],
];

export default function HomeScreen({ layout, setTab }) {
  return (
    <View style={{ gap: layout.sectionGap }}>
      <View style={[styles.hero, { paddingHorizontal: layout.tablet ? 42 : layout.compact ? 16 : 22, paddingVertical: layout.tablet ? 46 : 28 }]}>
        <View style={styles.pinHalo}>
          <Image source={require('../../assets/pin.png')} resizeMode="contain" style={styles.pin} />
        </View>
        <Text style={styles.eyebrow}>PICKANDSYNC</Text>
        <Text style={[styles.title, { fontSize: layout.heroTitleSize, lineHeight: layout.heroTitleSize * 1.08 }]}>
          Travel together. Book wheels. Split fairly.
        </Text>
        <Text style={[styles.subtitle, layout.tablet && styles.subtitleTablet]}>
          Join group trips, rent community cars or bikes, and keep every cost clear — built for crews on the move.
        </Text>

        <Surface style={[styles.searchSurface, layout.tablet && styles.searchSurfaceTablet]}>
          <View style={styles.modeRow}>
            <Pill tone="blue">Trips</Pill>
            <Text style={styles.mode}>Cars</Text>
            <Text style={styles.mode}>Bikes</Text>
            <Text style={styles.mode}>Explore</Text>
          </View>
          <Text style={styles.searchTitle}>What would you like to pick today?</Text>
          <View style={[styles.actionRow, !layout.wide && styles.actionColumn]}>
            <AppButton style={styles.action} onPress={() => setTab('Rentals')}>Search Cars & Bikes</AppButton>
            <AppButton style={styles.action} variant="ghost" onPress={() => Linking.openURL('https://pickandsync.com/trips')}>
              Browse Group Trips
            </AppButton>
          </View>
          <Text style={styles.customText}>
            Can’t find the right plan? <Text style={styles.customLink} onPress={() => setTab('Host')}>Host your vehicle</Text>
          </Text>
        </Surface>
      </View>

      <View style={styles.stats}>
        {[
          ['JOIN', 'Shared trips'],
          ['SPLIT', 'Costs fairly'],
          ['RENT', 'Local wheels'],
        ].map(([value, label]) => (
          <View key={value} style={styles.stat}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View>
        <Text style={styles.sectionEyebrow}>ONE PLATFORM</Text>
        <Text style={[styles.sectionTitle, { fontSize: layout.headingSize }]}>Everything stays in sync.</Text>
        <ResponsiveGrid columns={layout.cardColumns} gap={14} style={styles.featureGrid}>
          {featureCards.map(([title, description], index) => (
            <Surface key={title} style={styles.featureCard}>
              <View style={styles.featureIcon}><Text style={styles.featureIconText}>{index + 1}</Text></View>
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
  hero: { alignItems: 'center', backgroundColor: colors.blueSoft, borderColor: colors.blueBorder, borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
  pinHalo: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)', marginBottom: 12 },
  pin: { width: 58, height: 58 },
  eyebrow: { color: colors.blueDark, fontSize: 14, fontWeight: '900', letterSpacing: 1.3, marginBottom: 10 },
  title: { color: colors.navy, fontWeight: '900', letterSpacing: -1.4, maxWidth: 850, textAlign: 'center' },
  subtitle: { color: colors.navySoft, fontSize: 16, lineHeight: 23, maxWidth: 700, marginTop: 14, textAlign: 'center' },
  subtitleTablet: { fontSize: 18, lineHeight: 27 },
  searchSurface: { width: '100%', marginTop: 24, padding: 16 },
  searchSurfaceTablet: { padding: 22, maxWidth: 920 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginBottom: 15 },
  mode: { color: colors.subtle, fontWeight: '800', fontSize: 14 },
  searchTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  actionColumn: { flexDirection: 'column', gap: 2 },
  action: { flex: 1 },
  customText: { color: colors.subtle, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  customLink: { color: colors.blue, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 17, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
  statValue: { color: colors.blue, fontWeight: '900', fontSize: 16 },
  statLabel: { color: colors.subtle, fontSize: 11, marginTop: 3, fontWeight: '700', textAlign: 'center' },
  sectionEyebrow: { color: colors.blue, fontSize: 12, letterSpacing: 1.3, fontWeight: '900', marginTop: 6 },
  sectionTitle: { color: colors.navy, fontWeight: '900', letterSpacing: -0.8, marginTop: 5, marginBottom: 16 },
  featureGrid: { marginBottom: 6 },
  featureCard: { minHeight: 185 },
  featureIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  featureIconText: { color: colors.white, fontWeight: '900' },
  featureTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', marginBottom: 7 },
  featureText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
