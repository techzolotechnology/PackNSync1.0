import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { Body, Button, c, Card, Field, Icon, Label, Logo, Notice, Row, Title } from '../ui';

export default function AuthScreen({ onSignedIn }) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);
  useEffect(() => { if (!wait) return; const timer = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(timer); }, [wait]);
  const requestCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || register && !name.trim()) return setError('Enter your email address' + (register ? ' and full name.' : '.'));
    setBusy(true); setError('');
    try {
      await api.post('/auth/request-otp', { contact: email.trim().toLowerCase(), ...(register ? { isRegister: true, name: name.trim() } : {}) });
      setSent(true); setWait(60);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setError('Enter the six-digit code from your email.');
    setBusy(true); setError('');
    try {
      const result = await api.post('/auth/verify-otp', { contact: email.trim().toLowerCase(), otpCode: code });
      await api.signIn(result);
      onSignedIn(result.user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: 42, flexGrow: 1, justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' }}>
    <Row style={{ marginBottom: 35 }}><Logo size={49} /><View><Label>PickAndSync</Label><Body>HOST APP</Body></View></Row>
    <BadgeHeading />
    <Title style={{ fontSize: 40, lineHeight: 45, marginTop: 17 }}>Your keys.{'\n'}Your business.</Title>
    <Body style={{ fontSize: 16, marginTop: 12, marginBottom: 28 }}>Your fleet, bookings and earnings.{"\n"}One place to stay in control.</Body>
    <Card style={{ padding: 23 }}>
      <Title style={{ fontSize: 23, marginBottom: 7 }}>{sent ? 'Check your inbox' : register ? 'Start hosting' : 'Welcome back'}</Title>
      <Body style={{ marginBottom: 22 }}>{sent ? `We sent a sign-in code to ${email.trim()}.` : 'Use your existing PickAndSync account or create one.'}</Body>
      {error ? <Notice error>{error}</Notice> : null}
      {!sent ? <>
        {register && <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" maxLength={100} />}
        <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} onSubmitEditing={requestCode} />
        <Button icon="arrow-forward" onPress={requestCode} busy={busy}>Send sign-in code</Button>
        <Pressable accessibilityRole="button" onPress={() => { setRegister(!register); setError(''); }} style={{ paddingVertical: 19, alignItems: 'center' }}><Text style={{ color: c.blue, fontWeight: '600' }}>{register ? 'Already have an account? Sign in' : 'New to PickAndSync? Create an account'}</Text></Pressable>
      </> : <>
        <Field label="Six-digit email code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} onSubmitEditing={verify} autoFocus />
        <Button icon="lock-closed-outline" onPress={verify} busy={busy}>Open my host dashboard</Button>
        <Button secondary disabled={wait > 0} busy={busy} onPress={requestCode} style={{ marginTop: 10 }}>{wait ? `Resend code in ${wait}s` : 'Resend code'}</Button>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setSent(false); setCode(''); setError(''); }} style={{ paddingVertical: 16, alignItems: 'center' }}><Text style={{ color: c.blue }}>Use a different email</Text></Pressable>
      </>}
    </Card>
    <Row style={{ justifyContent: 'center', marginVertical: 20 }}><Icon name="shield-checkmark-outline" size={16} color={c.muted} /><Body>Secure email sign-in · No password to remember</Body></Row>
  </ScrollView></KeyboardAvoidingView>;
}
const BadgeHeading = () => <Row style={{ alignSelf: 'flex-start', backgroundColor: c.amberBg, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9 }}><Icon name="key-outline" size={15} color={c.amber} /><Text style={{ color: c.amber, fontWeight: '700', fontSize: 11, letterSpacing: 1 }}>BUILT FOR VEHICLE HOSTS</Text></Row>;
