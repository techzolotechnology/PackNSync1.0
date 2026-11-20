import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { AppButton, Field, Notice, SectionHeader, SegmentedControl, Surface } from './ui';
const blank = { hostType: 'INDIVIDUAL', businessName: '', address: '', contactNumber: '', gstNumber: '', registrationReference: '' };
export default function RentalBusinessProfile({ user }) {
  const [form, setForm] = useState(blank); const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const load = async () => {
    setReady(false);
    try { const res = await api.get('/users/me/business'); setForm(res.data || blank); setReady(true); setMessage(''); }
    catch(e) { setMessage(e.message); }
  };
  useEffect(() => { if (user) load(); }, [user?.id]);
  if (!user) return null;
  const save = async () => {
    setBusy(true);
    try { const res = await api.put('/users/me/business', { ...form, expectedVersion: form.version }); setForm(res.data); setMessage(res.data.status === 'PENDING' ? 'Submitted for admin review. Publish your vehicles after approval.' : 'Host profile saved.'); }
    catch(e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  return <Surface style={{ marginBottom: 14, gap: 12 }}>
    <SectionHeader title="How do you host?" subtitle="One profile for all your vehicles." />
    {!ready ? <><Notice>{message || 'Loading host profile…'}</Notice><AppButton onPress={load}>Retry</AppButton></> : <>
      <SegmentedControl value={form.hostType} onChange={hostType => setForm({ ...form, hostType })} options={[{ key: 'INDIVIDUAL', label: 'Individual', icon: 'person-outline' }, { key: 'RENTAL_SHOP', label: 'Rental shop owner', icon: 'business-outline' }]} />
      {form.hostType === 'RENTAL_SHOP' && <View style={{ gap: 12 }}>
        <Text>Business review is separate from identity and vehicle checks. Changed details require another review.</Text>
        {[['businessName','SHOP / BUSINESS NAME'],['address','BUSINESS ADDRESS'],['contactNumber','CONTACT NUMBER'],['registrationReference','REGISTRATION / RENTAL PERMIT REFERENCE'],['gstNumber','GST NUMBER (OPTIONAL)']].map(([key,label]) => <Field key={key} label={label} value={form[key]} onChangeText={value => setForm({ ...form, [key]: value })} />)}
        <Text>Review status: {form.status || 'Not submitted'}</Text>
        {!!form.reviewNotes && <Text>Admin feedback: {form.reviewNotes}</Text>}
      </View>}
      <AppButton loading={busy} onPress={save}>Save host profile</AppButton>
      <Notice>{message}</Notice>
    </>}
  </Surface>;
}
