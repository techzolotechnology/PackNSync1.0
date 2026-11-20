import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, shadows } from '../theme';
import { addDays, weekdayDate } from '../utils/dates';
import { tapFeedback } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const TONES = {
  blue: { bg: '#e9f5ff', fg: colors.blueDark, border: '#9dcef2' },
  gold: { bg: colors.goldPale, fg: colors.goldText, border: '#f5d76e' },
  green: { bg: colors.successPale, fg: colors.success, border: '#9fdcc0' },
  red: { bg: colors.dangerPale, fg: colors.danger, border: '#ffc6c1' },
  gray: { bg: '#f1f5f9', fg: colors.subtle, border: '#dbe3ec' },
};

export function Icon({ name, size = 20, color = colors.navy, style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

// Every tappable thing sinks slightly while pressed and gives a light tick.
export function PressableScale({ children, onPress, disabled, style, haptic = true, scaleTo = 0.97, accessibilityRole = 'button', accessibilityLabel, accessibilityState, hitSlop }) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (toValue) => Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue === 1 ? 7 : 0 }).start();
  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => springTo(scaleTo)}
      onPressOut={() => springTo(1)}
      onPress={(event) => {
        if (haptic) tapFeedback();
        onPress?.(event);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

const BUTTON_PALETTES = {
  primary: { box: { backgroundColor: colors.blue, ...shadows.button }, text: colors.white },
  ghost: { box: { backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: '#9dcef2' }, text: colors.blueDark },
  soft: { box: { backgroundColor: colors.blueSoft }, text: colors.blueDark },
  danger: { box: { backgroundColor: colors.dangerPale, borderWidth: 1, borderColor: '#ffc6c1' }, text: colors.danger },
};

export function AppButton({ children, onPress, variant = 'primary', disabled, compact, style, icon, iconRight, loading }) {
  const palette = BUTTON_PALETTES[variant] || BUTTON_PALETTES.primary;
  const iconSize = compact ? 16 : 18;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityState={{ busy: !!loading }}
      style={[styles.button, compact && styles.buttonCompact, palette.box, (disabled || loading) && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.text} /> : !!icon && <Icon name={icon} size={iconSize} color={palette.text} />}
      <Text numberOfLines={1} style={[styles.buttonText, compact && styles.buttonTextCompact, { color: palette.text }]}>{children}</Text>
      {!!iconRight && !loading && <Icon name={iconRight} size={iconSize} color={palette.text} />}
    </PressableScale>
  );
}

export function IconButton({ icon, onPress, label, disabled, tone = 'blue', size = 40, style }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      scaleTo={0.88}
      hitSlop={6}
      style={[styles.iconButton, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg }, disabled && styles.disabled, style]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={t.fg} />
    </PressableScale>
  );
}

export function IconCircle({ name, tone = 'blue', size = 42 }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <View style={[styles.iconCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg }]}>
      <Icon name={name} size={Math.round(size * 0.5)} color={t.fg} />
    </View>
  );
}

export function Pill({ children, tone = 'gold', style, icon }) {
  const t = TONES[tone] || TONES.gold;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      {!!icon && <Icon name={icon} size={13} color={t.fg} />}
      <Text style={[styles.pillText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function Chip({ label, icon, active, onPress }) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      {!!icon && <Icon name={icon} size={15} color={active ? colors.white : colors.blueDark} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableScale>
  );
}

export function Field({ label, containerStyle, multiline, icon, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      {!!label && <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>}
      <View style={[styles.inputWrap, multiline && styles.inputWrapMultiline, focused && styles.inputWrapFocused]}>
        {!!icon && <Icon name={icon} size={18} color={focused ? colors.blue : colors.subtle} style={styles.inputIcon} />}
        <TextInput
          {...inputProps}
          multiline={multiline}
          placeholderTextColor="#94a3b8"
          onFocus={(event) => { setFocused(true); inputProps.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); inputProps.onBlur?.(event); }}
          style={[styles.input, multiline && styles.inputMultiline, inputProps.style]}
        />
      </View>
    </View>
  );
}

/** A day picker that never needs typing: ‹ Sat, 11 Oct ›. */
export function DateStepper({ label, value, onChange, min }) {
  const canGoBack = !min || value > min;
  const year = String(value).slice(0, 4);
  const showYear = year !== String(new Date().getFullYear());
  return (
    <View style={styles.field}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.stepper}>
        <IconButton icon="chevron-back" label={`${label || 'Date'}: previous day`} disabled={!canGoBack} onPress={() => onChange(addDays(value, -1))} size={38} />
        <View style={styles.stepperMiddle} accessible accessibilityLabel={`${label || 'Date'} ${weekdayDate(value)} ${year}`}>
          <Icon name="calendar-outline" size={17} color={colors.blue} />
          <Text style={styles.stepperText}>{weekdayDate(value)}{showYear ? ` ${year}` : ''}</Text>
        </View>
        <IconButton icon="chevron-forward" label={`${label || 'Date'}: next day`} onPress={() => onChange(addDays(value, 1))} size={38} />
      </View>
    </View>
  );
}

/** Six boxes for an emailed code; one hidden input underneath does the typing and pasting. */
export function OtpInput({ value, onChange, length = 6, autoFocus }) {
  const [focused, setFocused] = useState(false);
  const digits = String(value || '').split('');
  const activeIndex = Math.min(digits.length, length - 1);
  return (
    <View style={styles.otpRow}>
      {Array.from({ length }, (_, index) => (
        <View
          key={index}
          style={[styles.otpBox, !!digits[index] && styles.otpBoxFilled, focused && index === activeIndex && styles.otpBoxActive]}
        >
          <Text style={styles.otpDigit}>{digits[index] || ''}</Text>
        </View>
      ))}
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        textContentType="oneTimeCode"
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={`${length}-digit sign-in code`}
        style={styles.otpHidden}
      />
    </View>
  );
}

export function SegmentedControl({ options, value, onChange }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const slide = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(slide, { toValue: index, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [index, slide]);
  const segment = width ? (width - 8) / options.length : 0;
  return (
    <View style={styles.segmented} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {segment > 0 && (
        <Animated.View
          style={[styles.segmentIndicator, { width: segment, transform: [{ translateX: Animated.multiply(slide, segment) }] }]}
        />
      )}
      {options.map((option) => {
        const active = option.key === value;
        return (
          <PressableScale
            key={option.key}
            onPress={() => onChange(option.key)}
            scaleTo={0.96}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            {!!option.icon && <Icon name={option.icon} size={16} color={active ? colors.blue : colors.subtle} />}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function ToggleRow({ icon, title, subtitle, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      {!!icon && <IconCircle name={icon} tone={value ? 'blue' : 'gray'} size={38} />}
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => { tapFeedback(); onValueChange(next); }}
        trackColor={{ false: '#cbd5e1', true: '#8cc6ff' }}
        thumbColor={value ? colors.blue : '#f8fafc'}
        activeThumbColor={colors.blue}
        accessibilityLabel={title}
      />
    </View>
  );
}

export function Surface({ children, style, onPress }) {
  if (onPress) return <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.surface, style]}>{children}</PressableScale>;
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function ListRow({ icon, tone = 'blue', title, subtitle, caption, right, onPress, chevron = !!onPress, last }) {
  const content = (
    <>
      {!!icon && <IconCircle name={icon} tone={tone} size={40} />}
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, tone === 'red' && { color: colors.danger }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text>}
        {!!caption && <Text style={styles.rowCaption} numberOfLines={1}>{caption}</Text>}
      </View>
      {right}
      {chevron && <Icon name="chevron-forward" size={18} color="#94a3b8" />}
    </>
  );
  const rowStyle = [styles.listRow, last && styles.listRowLast];
  if (onPress) return <PressableScale onPress={onPress} scaleTo={0.98} style={rowStyle}>{content}</PressableScale>;
  return <View style={rowStyle}>{content}</View>;
}

export function SectionHeader({ title, subtitle, actionLabel, actionIcon, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {!!onAction && (
        <PressableScale onPress={onAction} scaleTo={0.94} hitSlop={8} style={styles.sectionAction}>
          {!!actionIcon && <Icon name={actionIcon} size={15} color={colors.blue} />}
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </PressableScale>
      )}
    </View>
  );
}

export function EmptyState({ icon, title, text, actionLabel, actionIcon, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyHalo}><Icon name={icon} size={30} color={colors.blue} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
      {!!onAction && <AppButton variant="soft" icon={actionIcon} onPress={onAction} style={styles.emptyAction}>{actionLabel}</AppButton>}
    </View>
  );
}

export function Skeleton({ height = 14, width = '100%', radius = 8, style }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: colors.skeleton, opacity: pulse }, style]} />;
}

/** Placeholder rows shown while a list loads, shaped like the real ones. */
export function SkeletonList({ rows = 3 }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={[styles.flex, { gap: 8 }]}>
            <Skeleton width="62%" height={14} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function PageIntro({ eyebrow, title, description, layout, icon }) {
  return (
    <View style={styles.pageIntro}>
      {!!eyebrow && (
        <View style={styles.eyebrowRow}>
          {!!icon && <Icon name={icon} size={15} color={colors.blue} />}
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
      )}
      <Text style={[styles.heading, { fontSize: layout.headingSize, lineHeight: Math.round(layout.headingSize * 1.18) }]}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const NOTICE_ICONS = { gold: 'information-circle', error: 'alert-circle', success: 'checkmark-circle' };

export function Notice({ children, tone = 'gold' }) {
  if (!children) return null;
  const t = tone === 'error' ? TONES.red : tone === 'success' ? TONES.green : TONES.gold;
  return (
    <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityLiveRegion="polite">
      <Icon name={NOTICE_ICONS[tone] || NOTICE_ICONS.gold} size={18} color={t.fg} style={styles.noticeIcon} />
      <Text style={[styles.noticeText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

// Rows of equal-width cells; the last row is padded so every cell keeps the same width.
export function ResponsiveGrid({ children, columns = 1, gap = 14, style }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const rows = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={[{ gap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.gridRow, { gap }]}>
          {row.map((child, c) => <View key={child.key ?? c} style={styles.gridCell}>{child}</View>)}
          {row.length < columns && Array.from({ length: columns - row.length }, (_, k) => <View key={`pad-${k}`} style={styles.gridCell} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 5,
  },
  buttonCompact: { minHeight: 42, paddingHorizontal: 16, borderRadius: 999, marginVertical: 0, gap: 6 },
  disabled: { opacity: 0.5 },
  buttonText: { fontWeight: '800', fontSize: 15 },
  buttonTextCompact: { fontSize: 14 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: { fontWeight: '800', fontSize: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#b9dcf6',
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: colors.blueDark, fontWeight: '800', fontSize: 14 },
  chipTextActive: { color: colors.white },
  field: { marginBottom: 13, width: '100%' },
  label: { color: '#4b6478', fontWeight: '800', marginBottom: 7, fontSize: 12, letterSpacing: 0.3 },
  labelFocused: { color: colors.blue },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputWrapMultiline: { alignItems: 'flex-start', paddingTop: 2 },
  inputWrapFocused: { borderColor: colors.blue, backgroundColor: '#fbfdff' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, minHeight: 49, color: colors.text, paddingVertical: 12, fontSize: 16 },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 54,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 7,
  },
  stepperMiddle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  stepperText: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  otpRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: '#8cc6ff', backgroundColor: '#f5fbff' },
  otpBoxActive: { borderColor: colors.blue, borderWidth: 2 },
  otpDigit: { color: colors.navy, fontSize: 22, fontWeight: '900' },
  otpHidden: { ...StyleSheet.absoluteFillObject, opacity: 0, color: 'transparent' },
  segmented: { flexDirection: 'row', backgroundColor: '#e3f1fc', borderRadius: 16, padding: 4, marginBottom: 16 },
  segmentIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: colors.white, ...shadows.card },
  segment: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segmentText: { color: colors.subtle, fontWeight: '800', fontSize: 14 },
  segmentTextActive: { color: colors.blue },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, marginBottom: 8 },
  surface: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 18,
    ...shadows.card,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  listRowLast: { borderBottomWidth: 0 },
  rowTitle: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  rowSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  rowCaption: { color: colors.subtle, fontSize: 12, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionTitle: { color: colors.navy, fontSize: 19, fontWeight: '900' },
  sectionSubtitle: { color: colors.muted, lineHeight: 19, marginTop: 2, fontSize: 13 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 4 },
  sectionActionText: { color: colors.blue, fontWeight: '800', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 10 },
  emptyHalo: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.muted, lineHeight: 21, textAlign: 'center', maxWidth: 420, marginTop: 6 },
  emptyAction: { marginTop: 12, alignSelf: 'stretch' },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pageIntro: { marginBottom: 18 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  eyebrow: { color: colors.blue, fontWeight: '900', fontSize: 13, letterSpacing: 1.4 },
  heading: { color: colors.navy, fontWeight: '900', letterSpacing: -0.8 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, maxWidth: 680 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 13, padding: 11, marginTop: 10 },
  noticeIcon: { marginTop: 1 },
  noticeText: { flex: 1, lineHeight: 20, fontWeight: '600' },
  gridRow: { flexDirection: 'row', alignItems: 'stretch' },
  gridCell: { flex: 1, minWidth: 0 },
});
