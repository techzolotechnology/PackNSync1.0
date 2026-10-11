import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';
import { tapFeedback } from '../utils/haptics';

// Account opens from the header; hosting from Home, Rentals and Account.
const tabs = [
  { key: 'Home', label: 'Home', icon: 'home' },
  { key: 'Trips', label: 'Trips', icon: 'people' },
  { key: 'Rentals', label: 'Rent', icon: 'car-sport' },
  { key: 'Bookings', label: 'Bookings', icon: 'calendar' },
  { key: 'Wallet', label: 'Wallet', icon: 'wallet' },
];

function TabButton({ tab, active, onPress, compact }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(progress, { toValue: active ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 8 }).start();
  }, [active, progress]);

  const pillScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const iconLift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      onPress={() => { tapFeedback(); onPress(); }}
      style={styles.item}
    >
      <View style={styles.iconSlot}>
        <Animated.View style={[styles.pill, { opacity: progress, transform: [{ scaleX: pillScale }] }]} />
        <Animated.View style={{ transform: [{ translateY: iconLift }] }}>
          <Ionicons name={active ? tab.icon : `${tab.icon}-outline`} size={22} color={active ? colors.blue : colors.subtle} />
        </Animated.View>
      </View>
      <Text numberOfLines={1} style={[styles.label, compact && styles.labelCompact, active && styles.labelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

export default function BottomNav({ activeTab, setTab, layout }) {
  if (layout.tablet) return null;

  return (
    <View style={styles.nav} accessibilityRole="tablist">
      {tabs.map((tab) => (
        <TabButton key={tab.key} tab={tab} active={tab.key === activeTab} compact={layout.compact} onPress={() => setTab(tab.key)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingBottom: 8,
    shadowColor: colors.navy,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 12,
  },
  item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  iconSlot: { width: 58, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { ...StyleSheet.absoluteFillObject, borderRadius: 16, backgroundColor: '#e3f1ff' },
  label: { color: colors.subtle, fontSize: 11, fontWeight: '700', marginTop: 3 },
  labelCompact: { fontSize: 10 },
  labelActive: { color: colors.blue, fontWeight: '900' },
});
