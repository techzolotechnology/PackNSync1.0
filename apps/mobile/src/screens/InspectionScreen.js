import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from '../api';
import { API_BASE_URL, WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { AppButton, Chip, Field, Notice, PageIntro, Pill, Surface } from '../components/ui';

const VIEWS = [
  ['front', 'Front', 'Include the bumper, headlights and bonnet.'],
  ['rear', 'Rear', 'Include the bumper, tail lights and boot.'],
  ['left', 'Left side', 'Include both wheels, doors and side panels.'],
  ['right', 'Right side', 'Include both wheels, doors and side panels.'],
  ['windshield', 'Windshield', 'Show the full glass surface in clear light.'],
  ['interior', 'Interior', 'Show seats, dashboard and interior condition.'],
];
const emptyPhotos = () => VIEWS.map(([angle]) => ({ angle, url: '', condition: 'not_reported', findings: [] }));
const MAX_PHOTO_BYTES = 1024 * 1024;
const MAX_BASE64_LENGTH = 1398104;
const decodedBytes = value => value.length * 3 / 4 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
const fitsPhotoLimit = value => value.length <= MAX_BASE64_LENGTH && decodedBytes(value) <= MAX_PHOTO_BYTES;
const optionalInteger = (value, label, max) => {
  if (!value.trim()) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) throw new Error(`${label} must be a whole number between 0 and ${max}.`);
  return number;
};

// Image requests bypass api's refresh handling. Retry once after an authenticated
// JSON request, which uses the existing shared token-renewal flow on a 401.
function SavedInspectionImage({ uri, base, label, onFailure }) {
  const [attempt, setAttempt] = useState(0);
  const retrying = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const retry = async () => {
    if (retrying.current) return;
    retrying.current = true;
    try {
      if (attempt > 0) { onFailure(); return; }
      await api.get(base);
      if (active.current) setAttempt(1);
    } catch { if (active.current) onFailure(); }
    finally { retrying.current = false; }
  };
  return <Image key={attempt} source={{ uri, headers: api.authorizationHeaders() }} style={styles.photo} resizeMode="contain" accessibilityLabel={label} onError={retry} />;
}

export default function InspectionScreen({ booking, layout, onClose }) {
  // A changed booking always gets fresh state, even outside BookingsScreen.
  return <BookingInspection key={booking.id} booking={booking} layout={layout} onClose={onClose} />;
}

function BookingInspection({ booking, layout, onClose }) {
  const base = `/rentals/bookings/${encodeURIComponent(booking.id)}/inspection`;
  const [report, setReport] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [photos, setPhotos] = useState(emptyPhotos);
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState('');
  const [stage, setStage] = useState('checkin');
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('gold');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    setLoaded(false);
    try {
      const response = await api.get(base);
      if (alive.current) { setReport(response.data); setLoaded(true); }
    } catch (error) {
      if (alive.current) { setMessage(error.message); setTone('error'); }
    }
  }, [base]);
  useEffect(() => { load(); }, [load]);
  const run = async (action) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { if (alive.current) { setMessage(error.message); setTone('error'); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const photo = photos[step];
  const change = (values) => setPhotos(current => current.map(item => item.angle === photo.angle ? { ...item, ...values } : item));
  const capture = (camera) => run(async () => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!alive.current) return;
    if (!permission.granted) throw new Error(`${camera ? 'Camera' : 'Photo library'} permission is required. Enable it in your device settings or use the website.`);
    const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, allowsMultipleSelection: false };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!alive.current || result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) throw new Error('Photo data could not be read. Please try another photo.');
    if (asset.width < 320 || asset.height < 240) throw new Error('Use a photo at least 320 × 240 pixels.');
    for (const [edge, quality] of [[1200, 0.75], [960, 0.6], [720, 0.45]]) {
      const scale = Math.min(1, edge / Math.max(asset.width, asset.height));
      const width = Math.round(asset.width * scale);
      const height = Math.round(asset.height * scale);
      if (width < 320 || height < 240) continue;
      const compressed = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width, height } }], { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!alive.current) return;
      if (compressed.base64?.startsWith('/9j/') && fitsPhotoLimit(compressed.base64)) {
        change({ url: `data:image/jpeg;base64,${compressed.base64}` });
        return;
      }
    }
    throw new Error('Photo could not be reduced below 1 MB at the required resolution. Take another photo.');
  });
  const submitStage = report?.hasCheckin ? 'checkout' : 'checkin';
  const canCapture = loaded && booking.status === 'PAID' && !report?.hasCheckout;
  const complete = photos.every(item => item.url && (item.condition !== 'damage_reported' || item.findings.every(finding => finding.note.trim())));
  const submit = () => run(async () => {
    if (!canCapture || !consent || !complete) throw new Error('Complete all six photos, describe reported damage, and give consent before saving.');
    const odo = optionalInteger(odometer, 'Odometer', 9999999);
    const percent = optionalInteger(fuel, 'Fuel percentage', 100);
    if (photos.some(item => !fitsPhotoLimit(item.url.split(',')[1] || ''))) throw new Error('Each photo must be 1 MB or smaller.');
    await api.post(`${base}/${submitStage}`, { images: photos, consent: true, ...(odo !== undefined ? { odometer: odo } : {}), ...(percent !== undefined ? { fuelPercent: percent } : {}) });
    if (!alive.current) return;
    setPhotos(emptyPhotos()); setConsent(false); setStep(0); setOdometer(''); setFuel('');
    setMessage('Evidence saved. Pending human review.'); setTone('success');
    await load();
  });
  const savedStages = ['checkin', 'checkout'].filter(key => report?.[key]);
  const selectedStage = savedStages.includes(stage) ? stage : savedStages[0];
  const review = (dispute) => run(async () => {
    if (!loaded || !selectedStage) throw new Error('Load saved evidence before responding.');
    if (dispute && !reason.trim()) throw new Error('Describe why you dispute this inspection.');
    await api.post(`${base}/${dispute ? 'dispute' : 'confirm'}`, dispute ? { reason: reason.trim() } : { stage: selectedStage, comment: comment.trim() });
    if (!alive.current) return;
    setMessage(dispute ? 'Dispute submitted for review.' : 'Confirmation recorded. Results remain pending review.'); setTone('success');
    setComment(''); setReason(''); await load();
  });
  return <View style={styles.page}>
    <AppButton variant="ghost" icon="arrow-back" disabled={busy} onPress={onClose}>Back to bookings</AppButton>
    <PageIntro eyebrow="VEHICLE INSPECTION" icon="camera" title="Pickup and return evidence" description="Capture the same six views in similar light and positions. Photos and condition notes are user reported and pending human review." layout={layout} />
    <Notice tone={tone}>{message}</Notice>
    <Text style={styles.help}>Inspection confirmations and recorded events document evidence and responses. They do not clear liability or decide charges, deposits, refunds or insurance.</Text>
    <AppButton compact variant="ghost" disabled={busy} onPress={() => run(load)}>Refresh report</AppButton>
    <AppButton compact variant="ghost" disabled={busy} onPress={() => run(() => Linking.openURL(`${WEBSITE_URL}/bookings`))}>Open website inspection</AppButton>
    <Text style={styles.help}>On the website, sign in and open this booking’s vehicle inspection. A native build with camera permissions is required for mobile capture.</Text>
    {!loaded && <Text style={styles.help}>Report unavailable or loading. Refresh to retry.</Text>}
    {canCapture && <Surface style={styles.section}>
      <Text style={styles.title}>{submitStage === 'checkin' ? 'Pickup' : 'Return'} · view {step + 1} of 6</Text>
      <View style={styles.row}>{VIEWS.map(([angle, label], index) => <Chip key={angle} label={`${photos[index].url ? '✓ ' : ''}${label}`} active={step === index} onPress={() => !busy && setStep(index)} />)}</View>
      <Text style={styles.title}>{VIEWS[step][1]}</Text><Text style={styles.help}>{VIEWS[step][2]}</Text>
      {!!photo.url && <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="contain" accessibilityLabel={`${photo.angle} draft photo`} />}
      <View style={styles.row}><AppButton compact disabled={busy} onPress={() => capture(true)}>Take photo</AppButton><AppButton compact variant="ghost" disabled={busy} onPress={() => capture(false)}>Choose photo</AppButton></View>
      <Text style={styles.help}>Scratch notes are optional. If you see scratches or other damage, we recommend mentioning them before pickup. Your note is attached to this photo; describe the exact location.</Text>
      <View style={styles.row}>{['not_reported', 'no_visible_damage', 'damage_reported'].map(condition => <Chip key={condition} label={condition === 'damage_reported' ? 'Add scratch / damage note' : condition === 'not_reported' ? 'Skip notes (optional)' : 'I checked: no visible damage'} active={photo.condition === condition} onPress={() => !busy && change({ condition, findings: condition === 'damage_reported' ? (photo.findings.length ? photo.findings : [{ type: 'scratch', severity: 'minor', note: '' }]) : [] })} />)}</View>
      {photo.findings.map((finding, index) => <View key={index}>
        <Text style={styles.help}>Damage type</Text><View style={styles.row}>{['scratch', 'dent', 'crack', 'chip', 'broken', 'missing'].map(type => <Chip key={type} label={type} active={finding.type === type} onPress={() => !busy && change({ findings: [{ ...finding, type }] })} />)}</View>
        <Text style={styles.help}>Reported severity</Text><View style={styles.row}>{['minor', 'moderate', 'severe'].map(severity => <Chip key={severity} label={severity} active={finding.severity === severity} onPress={() => !busy && change({ findings: [{ ...finding, severity }] })} />)}</View>
        <Field label="Location and description" multiline maxLength={500} editable={!busy} value={finding.note} onChangeText={note => change({ findings: [{ ...finding, note }] })} />
      </View>)}
      <View style={styles.row}><AppButton compact variant="ghost" disabled={busy || step === 0} onPress={() => setStep(step - 1)}>Previous</AppButton><AppButton compact disabled={busy || !photo.url || step === 5} onPress={() => setStep(step + 1)}>Next view</AppButton></View>
      <Field label="Odometer (optional, whole km, 0–9,999,999)" keyboardType="numeric" editable={!busy} value={odometer} onChangeText={setOdometer} />
      <Field label="Fuel (optional, whole percent, 0–100%)" keyboardType="numeric" editable={!busy} value={fuel} onChangeText={setFuel} />
      <View style={styles.row}><Switch accessibilityLabel="Consent to saving inspection evidence" disabled={busy} value={consent} onValueChange={setConsent} /><Text style={styles.consent}>I consent to saving these photos and condition notes for this booking’s inspection.</Text></View>
      <Text style={styles.help}>{photos.filter(item => item.url).length}/6 photos ready. Review each view before saving.</Text>
      <AppButton loading={busy} disabled={!consent || !complete} onPress={submit}>Save {submitStage === 'checkin' ? 'pickup' : 'return'} evidence</AppButton>
    </Surface>}
    {loaded && savedStages.map(key => <Surface key={key} style={styles.section}>
      <Text style={styles.title}>{key === 'checkin' ? 'Pickup' : 'Return'} evidence</Text><Pill>Pending human review</Pill>
      {(report[key].images || []).map((item, index) => <View key={item.id || index} style={styles.section}>
        <Text style={styles.title}>{item.angle}</Text>
        {item.url?.startsWith(`${base}/images/`) && !/[?#]/.test(item.url) ? <SavedInspectionImage key={item.url} uri={`${API_BASE_URL}${item.url}`} base={base} label={`${key} ${item.angle}`} onFailure={() => { setMessage('A saved photo could not load. Refresh your session or review it on the website.'); setTone('error'); }} /> : <Text style={styles.help}>Photo URL unavailable. Review this photo on the website.</Text>}
        <Text style={styles.help}>{item.condition === 'damage_reported' ? 'Damage reported' : item.condition === 'no_visible_damage' ? 'No visible damage reported' : 'Scratch notes skipped (optional)'}</Text>
        {(item.findings || item.damages || []).map((finding, i) => <Text key={i} style={styles.help}>{finding.type} · {finding.severity}: {finding.note}</Text>)}
      </View>)}
    </Surface>)}
    {loaded && savedStages.length > 0 && <Surface style={styles.section}>
      <Text style={styles.title}>Respond to saved evidence</Text>
      <View style={styles.row}>{savedStages.map(key => <Chip key={key} label={key === 'checkin' ? 'Pickup' : 'Return'} active={selectedStage === key} onPress={() => !busy && setStage(key)} />)}</View>
      <Field label="Confirmation comment (optional)" multiline maxLength={500} editable={!busy} value={comment} onChangeText={setComment} />
      <AppButton disabled={busy} onPress={() => review(false)}>Confirm selected evidence</AppButton>
      <Field label="Reason for disputing this inspection" multiline maxLength={1000} editable={!busy} value={reason} onChangeText={setReason} />
      <AppButton variant="danger" disabled={busy || !reason.trim()} onPress={() => review(true)}>Submit dispute</AppButton>
    </Surface>}
  </View>;
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 10 },
  section: { marginTop: 12, gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  photo: { width: '100%', height: 220, backgroundColor: colors.bluePale, borderRadius: 12 },
  consent: { flex: 1, color: colors.text, fontSize: 14 },
});
