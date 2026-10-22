import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { useHost } from '../data';
import { Badge, Body, Button, c, Card, Field, Icon, Label, Notice, Row, Section, Sheet, Title, WebsiteButton } from '../ui';

export default function AccountScreen({ user, updateUser, onSignOut }) {
  const { resources, refresh } = useHost();
  const verification = resources.verification?.data;
  const [name, setName] = useState(user.name || '');
  const [city, setCity] = useState(user.city || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [signOut, setSignOut] = useState(false);
  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (!name.trim()) throw new Error('Enter your name.');
      await api.put(`/users/${user.id}`, { name: name.trim(), city: city.trim() });
      updateUser({ ...user, name: name.trim(), city: city.trim() });
      setMessage('Profile updated.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <View>
    <Section title="Your host account" />
    <Card><Row><View style={{ width: 57, height: 57, borderRadius: 19, backgroundColor: c.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '800', fontSize: 23, color: c.blue }}>{user.name?.slice(0, 1).toUpperCase() || 'H'}</Text></View><View style={{ flex: 1 }}><Title style={{ fontSize: 23 }}>{user.name}</Title><Body>{user.email}</Body></View></Row><Body style={{ marginTop: 15 }}>One PickAndSync identity across the website, guest app and host app.</Body></Card>
    <Section title="Verification" />
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}><Icon name="shield-checkmark-outline" color={c.green} /><Badge tone={verification?.isFullyVerified ? 'green' : 'amber'}>{verification?.isFullyVerified ? 'Identity verified' : 'Action needed'}</Badge></Row>
      {['AADHAAR', 'DL'].map((type) => { const state = verification?.latestByType?.[type]?.status; return <Row key={type} style={{ justifyContent: 'space-between', marginVertical: 9 }}><Label>{type === 'AADHAAR' ? 'Aadhaar' : 'Driving licence'}</Label><Body>{resources.verification?.error ? 'Unavailable' : state === 'VERIFIED' ? 'Verified' : state === 'PENDING' ? 'In review' : state === 'REJECTED' ? 'Resubmission needed' : 'Not submitted'}</Body></Row>; })}
      {!verification?.isFullyVerified && <><Body style={{ marginVertical: 15 }}>Submit your identity documents on the PickAndSync website using this same email, then return here and refresh.</Body><WebsiteButton path="/verify">Open document verification</WebsiteButton></>}
      <Button secondary icon="refresh-outline" onPress={refresh} style={{ marginTop: 12 }}>Refresh status</Button>
    </Card>
    {message ? <Notice>{message}</Notice> : null}{error ? <Notice error>{error}</Notice> : null}
    <Section title="Profile details" /><Card><Field label="Your name" value={name} onChangeText={setName} maxLength={100} /><Field label="City" value={city} onChangeText={setCity} maxLength={100} /><Button busy={busy} onPress={save}>Save profile</Button></Card>
    <Section title="Help & policies" /><View style={{ gap: 10, marginBottom: 22 }}><WebsiteButton path="/reports/new">Report a problem</WebsiteButton><WebsiteButton path="/terms">Terms & conditions</WebsiteButton><WebsiteButton path="/privacy-policy">Privacy policy</WebsiteButton></View>
    <Button secondary danger icon="log-out-outline" onPress={() => setSignOut(true)}>Sign out</Button>
    <Body style={{ textAlign: 'center', fontSize: 12, marginTop: 23 }}>PickAndSync Host · Version 1.1.0</Body>
    <Sheet visible={signOut} title="Sign out of the host app?" onClose={() => setSignOut(false)}><Body>You can sign in again with a code sent to your email.</Body><Button danger onPress={onSignOut}>Sign out</Button></Sheet>
  </View>;
}
