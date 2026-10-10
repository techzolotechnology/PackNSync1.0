import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { colors } from '../theme';
import { AppButton, Field, Notice, PageIntro, Surface } from '../components/ui';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export default function AccountScreen({ user, setUser, setTab, layout }) {
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [referral, setReferral] = useState(null);

  useEffect(() => {
    if (!user) { setReferral(null); return; }
    api.get('/users/me/referral').then((res) => setReferral(res.data)).catch(() => setReferral(null));
  }, [user]);

  const resetFlow = () => { setStep(1); setOtpCode(''); setMessage(''); };

  const requestOtp = async () => {
    if (!contact.trim()) return setMessage('Email address is required.');
    if (!isValidEmail(contact)) return setMessage('Enter a valid email address.');
    if (isRegister && !name.trim()) return setMessage('Name is required for registration.');
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/auth/request-otp', {
        contact: contact.trim(),
        name: isRegister ? name.trim() : undefined,
        isRegister,
        referralCode: isRegister && referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
      });
      setMessage(response.message || 'Code sent. Check your email.');
      setStep(2);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) return setMessage('Enter the 6-digit code.');
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/auth/verify-otp', { contact: contact.trim(), otpCode });
      api.setToken(response.accessToken, response.refreshToken);
      setUser(response.user);
      setStep(1);
      setOtpCode('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* signing out locally is enough */ }
    api.setToken(null);
    setUser(null);
    resetFlow();
  };

  const shareReferral = async () => {
    if (!referral?.link) return;
    try {
      await Share.share({ message: `Plan trips and rent cars & bikes with me on PickAndSync. Sign up with my link and we both get ${rupees(referral.rewardAmount)} credit after your first booking: ${referral.link}` });
    } catch { /* share sheet dismissed */ }
  };

  return (
    <View style={styles.page}>
      <PageIntro eyebrow="SYNC IN" title={user ? 'Your PickAndSync account.' : isRegister ? 'Create your account.' : 'Welcome back.'} description="Password-free sign-in with a one-time code, the same as the website. You stay signed in on this phone." layout={layout} />
      {user ? (
        <>
          <Surface style={styles.accountCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{String(user.name || 'P').slice(0, 1).toUpperCase()}</Text></View>
            <Text style={styles.userName}>{user.name || 'PickAndSync member'}</Text>
            <Text style={styles.userContact}>{user.email || 'Email connected account'}</Text>
            <View style={styles.quickLinks}>
              <AppButton compact style={styles.quickLink} onPress={() => setTab('Bookings')}>My bookings</AppButton>
              <AppButton compact style={styles.quickLink} variant="ghost" onPress={() => setTab('Wallet')}>Wallet</AppButton>
              <AppButton compact style={styles.quickLink} variant="ghost" onPress={() => setTab('Host')}>Host a vehicle</AppButton>
            </View>
          </Surface>
          {referral?.link && (
            <Surface style={styles.inviteCard}>
              <Text style={styles.cardTitle}>Invite friends, earn {rupees(referral.rewardAmount)}</Text>
              <Text style={styles.cardSubtitle}>When a friend signs up with your link and completes their first booking, you both get {rupees(referral.rewardAmount)} credit for rentals.</Text>
              <Text style={styles.code}>Your code: {referral.code}</Text>
              <AppButton onPress={shareReferral}>Share my invite link</AppButton>
              <Text style={styles.small}>{referral.invited || 0} signed up · {referral.rewarded || 0} rewarded</Text>
            </Surface>
          )}
          <AppButton variant="ghost" onPress={logout}>Log Out</AppButton>
        </>
      ) : (
        <Surface style={styles.accountCard}>
          <Text style={styles.cardTitle}>{step === 1 ? (isRegister ? 'Start with your details' : 'Sign in with an email code') : 'Enter your code'}</Text>
          <Text style={styles.cardSubtitle}>We email you a 6-digit code. No password needed.</Text>
          {step === 1 ? (
            <>
              {isRegister && <Field label="YOUR NAME" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />}
              <Field label="EMAIL ADDRESS" value={contact} onChangeText={setContact} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              {isRegister && <Field label="REFERRAL CODE (OPTIONAL)" value={referralCode} onChangeText={setReferralCode} placeholder="ABCD2345" autoCapitalize="characters" autoCorrect={false} maxLength={12} />}
              <AppButton onPress={requestOtp} disabled={loading}>{loading ? 'Sending…' : 'Get code'}</AppButton>
            </>
          ) : (
            <>
              <Text style={styles.codeHint}>Enter the 6-digit code sent to {contact}</Text>
              <Field label="CODE" value={otpCode} onChangeText={setOtpCode} placeholder="123456" keyboardType="number-pad" maxLength={6} />
              <AppButton onPress={verifyOtp} disabled={loading}>{loading ? 'Verifying…' : isRegister ? 'Create Account' : 'Sign In'}</AppButton>
              <AppButton variant="ghost" onPress={() => { setStep(1); setOtpCode(''); }}>Back</AppButton>
            </>
          )}
          <AppButton variant="ghost" onPress={() => { setIsRegister(!isRegister); resetFlow(); }}>{isRegister ? 'Already registered? Sign in' : 'New here? Create Account'}</AppButton>
          <Notice>{message}</Notice>
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 660, alignSelf: 'center' },
  accountCard: { padding: 22, marginBottom: 14 },
  inviteCard: { padding: 22, marginBottom: 14 },
  cardTitle: { color: colors.navy, fontSize: 22, fontWeight: '900' },
  cardSubtitle: { color: colors.muted, lineHeight: 21, marginTop: 5, marginBottom: 18 },
  codeHint: { color: colors.muted, lineHeight: 21, marginBottom: 14 },
  code: { color: colors.navy, fontWeight: '900', fontSize: 16, marginBottom: 8, letterSpacing: 1 },
  small: { color: colors.subtle, fontSize: 12, marginTop: 6, textAlign: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft, alignSelf: 'center', marginBottom: 14 },
  avatarText: { color: colors.blue, fontSize: 28, fontWeight: '900' },
  userName: { color: colors.navy, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  userContact: { color: colors.muted, marginTop: 4, textAlign: 'center' },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  quickLink: { minWidth: 120 },
});
