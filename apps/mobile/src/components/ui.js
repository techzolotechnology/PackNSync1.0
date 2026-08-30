import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, shadows } from '../theme';

export function AppButton({ children, onPress, variant = 'primary', disabled, compact, style }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.84}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonGhost,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'ghost' && styles.buttonGhostText]}>{children}</Text>
    </TouchableOpacity>
  );
}

export function Pill({ children, tone = 'gold', style }) {
  return (
    <View style={[styles.pill, tone === 'blue' && styles.pillBlue, style]}>
      <Text style={[styles.pillText, tone === 'blue' && styles.pillBlueText]}>{children}</Text>
    </View>
  );
}

export function Field({ label, containerStyle, multiline, ...inputProps }) {
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor="#94a3b8"
        style={[styles.input, multiline && styles.inputMultiline, inputProps.style]}
      />
    </View>
  );
}

export function Surface({ children, style }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function PageIntro({ eyebrow, title, description, layout }) {
  return (
    <View style={styles.pageIntro}>
      {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={[styles.heading, { fontSize: layout.headingSize }]}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

export function Notice({ children, tone = 'gold' }) {
  if (!children) return null;
  return (
    <View style={[styles.notice, tone === 'error' && styles.noticeError]}>
      <Text style={[styles.noticeText, tone === 'error' && styles.noticeErrorText]}>{children}</Text>
    </View>
  );
}

export function ResponsiveGrid({ children, columns = 1, gap = 14, style }) {
  const width = columns > 1 ? `${(100 - (columns - 1) * 2.2) / columns}%` : '100%';
  return (
    <View style={[styles.grid, { gap }, style]}>
      {React.Children.map(children, (child) => (
        <View style={{ width }}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
  },
  buttonCompact: { minHeight: 42, paddingHorizontal: 16, borderRadius: 999, marginVertical: 0 },
  buttonPrimary: { backgroundColor: colors.blue, ...shadows.button },
  buttonGhost: { backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: '#9dcef2' },
  disabled: { opacity: 0.52 },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  buttonGhostText: { color: colors.blueDark },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldPale,
    borderWidth: 1,
    borderColor: '#f5d76e',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillBlue: { backgroundColor: '#e9f5ff', borderColor: '#9dcef2' },
  pillText: { color: colors.goldText, fontWeight: '800', fontSize: 12 },
  pillBlueText: { color: colors.blueDark },
  field: { marginBottom: 13, width: '100%' },
  label: { color: '#4b6478', fontWeight: '800', marginBottom: 7, fontSize: 12, letterSpacing: 0.2 },
  input: {
    minHeight: 52,
    backgroundColor: colors.white,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 104, textAlignVertical: 'top' },
  surface: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 18,
    ...shadows.card,
  },
  pageIntro: { marginBottom: 18 },
  eyebrow: { color: colors.blue, fontWeight: '900', fontSize: 13, letterSpacing: 1.4, marginBottom: 7 },
  heading: { color: colors.navy, fontWeight: '900', letterSpacing: -0.8, lineHeight: 42 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, maxWidth: 680 },
  notice: { backgroundColor: colors.goldPale, borderWidth: 1, borderColor: '#f5d76e', borderRadius: 13, padding: 11, marginTop: 10 },
  noticeError: { backgroundColor: '#fff0ee', borderColor: '#ffc6c1' },
  noticeText: { color: colors.goldText, lineHeight: 20, fontWeight: '600' },
  noticeErrorText: { color: colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
});

