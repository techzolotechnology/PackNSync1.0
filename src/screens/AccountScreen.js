import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Share, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { unregisterPush } from '../push';
import { WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { AppButton, Field, Icon, IconCircle, ListRow, Notice, OtpInput, PageIntro, Pill, SegmentedControl, Surface } from '../components/ui';
import { errorFeedback, successFeedback } from '../utils/haptics';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const RESEND_SECONDS = 30;
const MODES = [
  { key: 'signin', label: 'Sign in', icon: 'log-in-outline' },
  { key: 'register', label: 'Create account', icon: 'person-add-outline' },
];

export default function AccountScreen({ user, setUser, setTab, layout, registerRefresh }) {
  const [mode, setMode] = useState('signin');
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('gold');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [referral, setReferral] = useState(null);
  const lastTried = useRef('');
  const isRegister = mode === 'register';

  const say = (text, nextTone = 'gold') => { setMessage(text); setTone(nextTone); };

  const loadReferral = useCallback(async () => {
    if (!user) return setReferral(null);
    const res = await api.get('/users/me/referral').catch(() => null);
    setReferral(res?.data || null);
  }, [user]);

  useEffect(() => { loadReferral(); }, [loadReferral]);
  useEffect(() => (user ? registerRefresh?.(loadReferral) : undefined), [user, registerRefresh, loadReferral]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resetFlow = () => { setStep(1); setOtpCode(''); say(''); lastTried.current = ''; };

  const requestOtp = async () => {
    if (!contact.trim()) return say('Email address is required.', 'error');
    if (!isValidEmail(contact)) return say('Enter a valid email address.', 'error');
    if (isRegister && !name.trim()) return say('Name is required for registration.', 'error');
    setLoading(true);
    say('');
    try {
      const response = await api.post('/auth/request-otp', {
        contact: contact.trim(),
        name: isRegister ? name.trim() : undefined,
        isRegister,
        referralCode: isRegister && referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
      });
      say(response.message || 'Code sent. Check your email.');
      setStep(2);
      setOtpCode('');
      lastTried.current = '';
      setCooldown(RESEND_SECONDS);
    } catch (error) {
      errorFeedback();
      say(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = useCallback(async (code) => {
    if (!code || code.length !== 6) return say('Enter the 6-digit code.', 'error');
    lastTried.current = code;
    setLoading(true);
    say('');
    try {
      const response = await api.post('/auth/verify-otp', { contact: contact.trim(), otpCode: code });
      api.setToken(response.accessToken, response.refreshToken);
      successFeedback();
      setUser(response.user);
      setStep(1);
      setOtpCode('');
    } catch (error) {
      errorFeedback();
      say(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [contact, setUser]);

  // All six digits in (typed or pasted): sign in straight away.
  useEffect(() => {
    if (step === 2 && otpCode.length === 6 && !loading && lastTried.current !== otpCode) verifyOtp(otpCode);
  }, [step, otpCode, loading, verifyOtp]);

  const logout = () => Alert.alert('Log out of PickAndSync?', 'You can sign back in with an email code any time.', [
    { text: 'Stay signed in', style: 'cancel' },
    {
      text: 'Log out',
      style: 'destructive',
      onPress: async () => {
        // Drop this device's push token while still authenticated, then sign out.
        await unregisterPush();
        try { await api.post('/auth/logout'); } catch { /* signing out locally is enough */ }
        api.setToken(null);
        setUser(null);
        resetFlow();
      },
    },
  ]);

  const shareReferral = async () => {
    if (!referral?.link) return;
    try {
      await Share.share({ message: `Plan trips and rent cars & bikes with me on PickAndSync. Sign up with my link and we both get ${rupees(referral.rewardAmount)} credit after your first booking: ${referral.link}` });
    } catch { /* share sheet dismissed */ }
  };

  if (user) {
    const initial = String(user.name || 'P').slice(0, 1).toUpperCase();
    return (
      <View style={styles.page}>
        <Surface style={styles.profileCard}>
          <View style={styles.profileRing}><View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View></View>
          <Text style={styles.userName}>{user.name || 'PickAndSync member'}</Text>
          <View style={styles.emailRow}>
            <Icon name="mail-outline" size={14} color={colors.muted} />
            <Text style={styles.userContact}>{user.email || 'Email connected account'}</Text>
          </View>
        </Surface>

        <Surface style={styles.menu}>
          <ListRow icon="calendar" title="My bookings" subtitle="Requests, payments and hosting" onPress={() => setTab('Bookings')} />
          <ListRow icon="wallet" tone="gold" title="Wallet" subtitle="Balance, promo credit and offers" onPress={() => setTab('Wallet')} />
          <ListRow icon="key" tone="green" title="Host a vehicle" subtitle="Earn from your car or bike" onPress={() => setTab('Host')} />
          <ListRow icon="shield-checkmark" title="Verify your ID" subtitle="Needed to book, host or join trips" onPress={() => Linking.openURL(`${WEBSITE_URL}/verify`)} />
          <ListRow icon="document-text" tone="gray" title="Terms & privacy" onPress={() => Linking.openURL(`${WEBSITE_URL}/terms`)} last />
        </Surface>

        {referral?.link && (
          <Surface style={styles.inviteCard}>
            <View style={styles.inviteHead}>
              <IconCircle name="gift" tone="gold" size={46} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>Invite friends, earn {rupees(referral.rewardAmount)}</Text>
                <Text style={styles.cardSubtitle}>You both get {rupees(referral.rewardAmount)} rental credit after their first booking.</Text>
              </View>
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>YOUR CODE</Text>
              <Text style={styles.code} selectable>{referral.code}</Text>
            </View>
            <AppButton icon="share-social-outline" onPress={shareReferral}>Share my invite link</AppButton>
            <View style={styles.statsRow}>
              <Pill tone="blue" icon="person-add-outline">{referral.invited || 0} signed up</Pill>
              <Pill tone="green" icon="gift-outline">{referral.rewarded || 0} rewarded</Pill>
            </View>
          </Surface>
        )}

        <AppButton variant="danger" icon="log-out-outline" onPress={logout}>Log out</AppButton>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <PageIntro
        eyebrow="SYNC IN"
        icon="person-circle"
        title={isRegister ? 'Create your account.' : 'Welcome back.'}
        description="Password-free sign-in with a one-time email code, the same as the website. You stay signed in on this phone."
        layout={layout}
      />
      <Surface style={styles.authCard}>
        {step === 1 ? (
          <>
            <SegmentedControl options={MODES} value={mode} onChange={(next) => { setMode(next); resetFlow(); }} />
            {isRegister && <Field label="YOUR NAME" icon="person-outline" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />}
            <Field label="EMAIL ADDRESS" icon="mail-outline" value={contact} onChangeText={setContact} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="send" onSubmitEditing={requestOtp} />
            {isRegister && <Field label="REFERRAL CODE (OPTIONAL)" icon="gift-outline" value={referralCode} onChangeText={setReferralCode} placeholder="ABCD2345" autoCapitalize="characters" autoCorrect={false} maxLength={12} />}
            <AppButton icon="mail" onPress={requestOtp} loading={loading}>{loading ? 'Sending…' : 'Email me a code'}</AppButton>
          </>
        ) : (
          <>
            <View style={styles.codeHead}>
              <IconCircle name="mail-open" size={52} />
              <Text style={styles.cardTitle}>Check your email</Text>
              <Text style={styles.codeHint}>Enter the 6-digit code we sent to <Text style={styles.bold}>{contact.trim()}</Text></Text>
            </View>
            <OtpInput value={otpCode} onChange={setOtpCode} autoFocus />
            <AppButton icon="log-in-outline" onPress={() => verifyOtp(otpCode)} loading={loading}>{loading ? 'Checking…' : isRegister ? 'Create account' : 'Sign in'}</AppButton>
            <View style={styles.codeLinks}>
              <AppButton compact variant="ghost" icon="arrow-back" onPress={resetFlow}>Change email</AppButton>
              <AppButton compact variant="soft" icon="refresh" disabled={cooldown > 0 || loading} onPress={requestOtp}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </AppButton>
            </View>
          </>
        )}
        <Notice tone={tone}>{message}</Notice>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 660, alignSelf: 'center' },
  flex: { flex: 1 },
  authCard: { padding: 20, marginBottom: 14 },
  profileCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 14 },
  profileRing: { padding: 4, borderRadius: 48, borderWidth: 2, borderColor: '#9dcef2', marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue },
  avatarText: { color: colors.white, fontSize: 32, fontWeight: '900' },
  userName: { color: colors.navy, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  userContact: { color: colors.muted },
  menu: { paddingVertical: 4, marginBottom: 14 },
  inviteCard: { marginBottom: 14, borderColor: '#f5d76e', backgroundColor: '#fffdf5' },
  inviteHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  cardTitle: { color: colors.navy, fontSize: 19, fontWeight: '900' },
  cardSubtitle: { color: colors.muted, lineHeight: 20, marginTop: 4 },
  codeBox: { alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#e6c75a', borderRadius: 16, paddingVertical: 12, marginBottom: 8, backgroundColor: colors.white },
  codeLabel: { color: colors.goldText, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  code: { color: colors.navy, fontWeight: '900', fontSize: 24, letterSpacing: 4, marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  codeHead: { alignItems: 'center', gap: 8, marginBottom: 16 },
  codeHint: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
  bold: { color: colors.navy, fontWeight: '800' },
  codeLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 6 },
});
