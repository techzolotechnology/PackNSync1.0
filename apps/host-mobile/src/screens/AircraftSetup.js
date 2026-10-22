import { useState } from 'react';
import { Image, View } from 'react-native';
import { api } from '../api';
import { DOCUMENTS } from '../categories';
import { aircraftVisibility, vehicleName, money } from '../model';
import { Badge, Body, Button, c, Card, Field, Label, Notice, Row, Section, Sheet, Title, WebsiteButton } from '../ui';
import { choosePhoto, upload } from '../photos';

export default function AircraftSetup({ vehicle, onClose, onChanged }) {
  const profile = vehicle.aircraftHosting;
  const visibility = aircraftVisibility(profile);
  const [operatorName, setOperatorName] = useState(profile?.operatorName || '');
  const [permit, setPermit] = useState(profile?.operatorPermitNumber || '');
  const [base, setBase] = useState(profile?.baseAirport || '');
  const [rate, setRate] = useState(String(profile?.pricePerHour || ''));
  const [description, setDescription] = useState(profile?.description || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [document, setDocument] = useState(null);
  const [asset, setAsset] = useState(null);
  const [expiry, setExpiry] = useState('');
  const run = async (action, success) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await onChanged(); setMessage(success); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const save = () => run(() => api.put(`/aviation/aircraft/${vehicle.id}`, { operatorName, operatorPermitNumber: permit, baseAirport: base, pricePerHour: Number(rate), description }), 'Details saved. Submit for review when the documents are ready.');
  const choose = async () => { try { const photo = await choosePhoto(false, true); if (photo) setAsset(photo); } catch (err) { setError(err.message); } };
  const submitDocument = () => run(async () => {
    if (!asset) throw new Error('Choose a document photo first.');
    if (document.expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || new Date(expiry) <= new Date() || !Number.isFinite(Date.parse(expiry)))) throw new Error('Enter the future expiry date as YYYY-MM-DD.');
    await upload(`/aviation/aircraft/${vehicle.id}/documents/${document.key}`, 'rcImage', asset, document.expiry ? { expiresAt: `${expiry}T23:59:59.999Z` } : {});
    setDocument(null); setAsset(null); setExpiry('');
  }, 'Document uploaded privately. Any earlier publication is paused until review.');
  if (!profile) return <Sheet visible title="Charter setup" onClose={onClose}><Notice error>Aircraft profile could not load. Refresh your fleet after deploying the charter migration.</Notice></Sheet>;
  return <Sheet visible title="Helicopter charter setup" onClose={() => { if (!busy) onClose(); }}>
    <Title style={{ fontSize: 24 }}>{vehicleName(vehicle)}</Title><Body>{vehicle.licensePlate} · {vehicle.seats} passenger seats</Body>
    <Row><Badge tone={visibility.ready ? 'green' : 'amber'}>{visibility.label}</Badge><Badge tone={visibility.visible ? 'green' : 'gray'}>{visibility.visible ? 'Published for enquiries' : 'Not published'}</Badge></Row>
    {profile.status === 'APPROVED' && !visibility.ready && <Notice>Aircraft evidence needs renewal. This listing stays hidden from customers until current documents are reviewed.</Notice>}
    <Notice>Helicopters are operator-flown charter services. An hourly estimate or quote is not a confirmed flight, payment or flight clearance.</Notice>
    {error ? <Notice error>{error}</Notice> : null}{message ? <Notice>{message}</Notice> : null}
    {profile.reviewNote && <Card><Label>Review findings</Label><Body>{profile.reviewNote}</Body></Card>}
    <Field label="Operator company name" value={operatorName} onChangeText={setOperatorName} maxLength={160} />
    <Field label="Operator permit reference" value={permit} onChangeText={setPermit} maxLength={120} />
    <Field label="Base airport / helipad" value={base} onChangeText={setBase} maxLength={200} />
    <Field label="Indicative hourly rate (INR)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
    <Field label="Charter service description" value={description} onChangeText={setDescription} multiline maxLength={3000} />
    <Body>Current indicative rate: {money(profile.pricePerHour, profile.currency)} / hour. Saving changes returns the aircraft to draft and pauses publication.</Body>
    <Button secondary busy={busy} onPress={save}>Save details for review</Button>
    <Section title="Aircraft & operator documents" />
    {DOCUMENTS.map((item) => {
      const doc = profile.documents?.[item.key];
      const valid = doc && (!item.expiry || new Date(doc.expiresAt) > new Date());
      return <Card key={item.key}><Label>{item.label}</Label><Body style={{ marginVertical: 8 }}>{doc ? `${valid ? 'Uploaded' : 'Expired / needs update'}${doc.expiresAt ? ` · Expires ${new Date(doc.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}` : 'Not uploaded'}</Body><Button secondary disabled={busy} onPress={() => { setDocument(item); setAsset(null); setExpiry(''); setError(''); }}>{doc ? 'Replace document' : 'Upload document'}</Button></Card>;
    })}
    {document && <Card style={{ borderColor: c.blue }}><Title style={{ fontSize: 19 }}>{document.label}</Title>{asset && <Image source={{ uri: asset.uri }} resizeMode="contain" style={{ width: '100%', height: 160, marginVertical: 12 }} />}<Button secondary disabled={busy} onPress={choose}>Choose document photo</Button>{document.expiry && <View style={{ marginTop: 14 }}><Field label="Document expiry (YYYY-MM-DD)" value={expiry} onChangeText={setExpiry} maxLength={10} /></View>}<Body style={{ marginVertical: 10 }}>JPG, PNG or WEBP · Up to 8 MB. Stored privately for operator review.</Body><Button busy={busy} disabled={!asset} onPress={submitDocument}>Save document</Button></Card>}
    {profile.status === 'APPROVED' ? <Button busy={busy} disabled={!visibility.ready && !profile.isPublished} onPress={() => run(() => api.patch(`/aviation/aircraft/${vehicle.id}/publish`, { isPublished: !profile.isPublished }), profile.isPublished ? 'Charter listing paused.' : 'Charter listing published for enquiries.')}>{profile.isPublished ? 'Pause charter listing' : 'Publish for charter enquiries'}</Button> : <Button busy={busy} disabled={profile.status === 'PENDING'} onPress={() => run(() => api.post(`/aviation/aircraft/${vehicle.id}/submit`, {}), 'Aircraft submitted. The team will review the documents and operator details.')}>{profile.status === 'PENDING' ? 'Waiting for operator review' : 'Submit for operator review'}</Button>}
    <WebsiteButton path="/helicopter-charters">Open charter directory</WebsiteButton>
  </Sheet>;
}
