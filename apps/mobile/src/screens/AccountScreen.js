import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../api';
import { colors } from '../theme';
import { AppButton, Field, Notice, PageIntro, Surface } from '../components/ui';

export default function AccountScreen({ user, setUser, layout }) {
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const resetFlow = () => { setStep(1); setOtpCode(''); setMessage(''); };

  const requestOtp = async () => {
    if (!contact.trim()) return setMessage('Email or phone number is required.');
    if (isRegister && !name.trim()) return setMessage('Name is required for registration.');
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/auth/request-otp', { contact: contact.trim(), name: isRegister ? name.trim() : undefined, isRegister });
      setMessage(response.message || 'OTP sent.');
      setStep(2);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) return setMessage('Enter the 6-digit OTP.');
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/auth/verify-otp', { contact: contact.trim(), otpCode });
      api.setToken(response.accessToken);
      setUser(response.user);
      setMessage('Logged in.');
      setStep(1);
      setOtpCode('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => { api.setToken(null); setUser(null); resetFlow(); };

  return (
    <View style={styles.page}>
      <PageIntro eyebrow="SYNC IN" title={user ? 'Your PickAndSync account.' : isRegister ? 'Create your account.' : 'Welcome back.'} description="One login connects your trips, bookings, and hosted vehicles across every platform." layout={layout} />
      <Surface style={styles.accountCard}>
        {user ? (
          <>
            <View style={styles.avatar}><Text style={styles.avatarText}>{String(user.name || 'P').slice(0, 1).toUpperCase()}</Text></View>
            <Text style={styles.userName}>{user.name || 'PickAndSync member'}</Text>
            <Text style={styles.userContact}>{user.email || user.phoneNumber || 'Connected account'}</Text>
            <View style={styles.accountRule} />
            <AppButton variant="ghost" onPress={logout}>Log Out</AppButton>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>{step === 1 ? (isRegister ? 'Start with your details' : 'Login with OTP') : 'Enter your code'}</Text>
            <Text style={styles.cardSubtitle}>Password-free and consistent with the PickAndSync website.</Text>
            {step === 1 ? (
              <>
                {isRegister && <Field label="YOUR NAME" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />}
                <Field label="EMAIL OR PHONE" value={contact} onChangeText={setContact} placeholder="you@example.com or +919876543210" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                <AppButton onPress={requestOtp} disabled={loading}>{loading ? 'Sending…' : 'Get OTP'}</AppButton>
              </>
            ) : (
              <>
                <Text style={styles.codeHint}>Enter the 6-digit code sent to {contact}</Text>
                <Field label="OTP" value={otpCode} onChangeText={setOtpCode} placeholder="123456" keyboardType="number-pad" maxLength={6} />
                <AppButton onPress={verifyOtp} disabled={loading}>{loading ? 'Verifying…' : isRegister ? 'Create Account' : 'Log In'}</AppButton>
                <AppButton variant="ghost" onPress={() => { setStep(1); setOtpCode(''); }}>Back</AppButton>
              </>
            )}
            <AppButton variant="ghost" onPress={() => { setIsRegister(!isRegister); resetFlow(); }}>{isRegister ? 'Already registered? Login' : 'New here? Create Account'}</AppButton>
            <Notice>{message}</Notice>
          </>
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 660, alignSelf: 'center' },
  accountCard: { padding: 22 },
  cardTitle: { color: colors.navy, fontSize: 22, fontWeight: '900' },
  cardSubtitle: { color: colors.muted, lineHeight: 21, marginTop: 5, marginBottom: 18 },
  codeHint: { color: colors.muted, lineHeight: 21, marginBottom: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft, alignSelf: 'center', marginBottom: 14 },
  avatarText: { color: colors.blue, fontSize: 28, fontWeight: '900' },
  userName: { color: colors.navy, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  userContact: { color: colors.muted, marginTop: 4, textAlign: 'center' },
  accountRule: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
});
