import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme';

const tabs = [
  ['Home', '\u2302'],
  ['Rentals', '\u25a3'],
  ['Host', '+'],
  ['Account', '\u25cf'],
];

export default function BottomNav({ activeTab, setTab, layout }) {
  if (layout.tablet) return null;

  return (
    <View style={styles.nav}>
      {tabs.map(([tab, symbol]) => {
        const active = tab === activeTab;
        return (
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab}
            onPress={() => setTab(tab)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.symbol, active && styles.textActive]}>{symbol}</Text>
            <Text numberOfLines={1} style={[styles.label, layout.compact && styles.labelCompact, active && styles.textActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, shadowColor: colors.navy, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -5 }, elevation: 12 },
  item: { flex: 1, minHeight: 66, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderTopWidth: 3, borderTopColor: 'transparent' },
  itemActive: { backgroundColor: '#eff8ff', borderTopColor: colors.blue },
  symbol: { color: colors.subtle, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  label: { color: colors.subtle, fontSize: 11, fontWeight: '700', marginTop: 2 },
  labelCompact: { fontSize: 10 },
  textActive: { color: colors.blue },
});
