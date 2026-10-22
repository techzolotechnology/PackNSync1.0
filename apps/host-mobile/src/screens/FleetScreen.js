import { useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { choosePhoto, upload } from '../photos';
import { api } from '../api';
import { imageUrl } from '../config';
import { useHost } from '../data';
import { aircraftVisibility, dateKey, money, shortDate, validRange, vehicleName, vehiclePayload } from '../model';
import { HOSTING_CATEGORIES, categoryFor } from '../categories';
import AircraftSetup from './AircraftSetup';
import { Badge, Body, Button, c, Card, Chips, Empty, Field, Icon, Label, Notice, Row, Section, Sheet, Title, WebsiteButton } from '../ui';

export default function FleetScreen({ navigate }) {
  const { resources, refresh } = useHost();
  const vehicles = resources.vehicles?.data || [];
  const listings = resources.listings?.data || [];
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [listing, setListing] = useState(null);
  const [rcVehicle, setRcVehicle] = useState(null);
  const [aircraft, setAircraft] = useState(null);
  const [notice, setNotice] = useState('');
  const isVerified = resources.verification?.data?.isFullyVerified;
  const visible = vehicles.filter((v) => (category === 'all' || category === v.type) && `${vehicleName(v)} ${v.licensePlate}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'review' ? v.type === 'HELICOPTER' ? !aircraftVisibility(v.aircraftHosting).ready : !v.isVerified : v.type === 'HELICOPTER' ? aircraftVisibility(v.aircraftHosting).visible : listings.some((l) => l.vehicleId === v.id && l.isActive))));
  return <View>
    <Section title="Your fleet" action="Add vehicle" onAction={() => setEditor({})} />
    <Body style={{ marginBottom: 18 }}>Host cars, bikes, scooters and operator-led helicopter charters.</Body>
    {!isVerified && <Notice action="View verification" onAction={() => navigate('Account')}>Complete your identity verification before adding a vehicle or publishing a listing.</Notice>}
    {notice ? <Notice>{notice}</Notice> : null}
    {resources.listings?.error && <Notice error>Listing controls could not load: {resources.listings.error}</Notice>}
    <Field label="Search fleet" placeholder="Make, model or registration" value={search} onChangeText={setSearch} />
    <Chips selected={category} onChange={setCategory} options={[{ key: 'all', label: `All (${vehicles.length})` }, ...HOSTING_CATEGORIES.map((item) => ({ key: item.key, label: `${item.plural} (${vehicles.filter((v) => v.type === item.key).length})` }))]} />
    <Chips selected={filter} onChange={setFilter} options={[{ key: 'all', label: 'All statuses' }, { key: 'live', label: 'Live listings' }, { key: 'review', label: 'Needs verification' }]} />
    {visible.map((v) => <Card key={v.id} style={{ padding: 0, overflow: 'hidden' }}>
      {imageUrl(v.images?.[0]) ? <Image source={{ uri: imageUrl(v.images[0]) }} style={{ width: '100%', height: 184, backgroundColor: c.bg }} resizeMode="cover" accessibilityLabel={vehicleName(v)} /> : <View style={{ height: 120, backgroundColor: c.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name={categoryFor(v.type).icon} size={60} color={c.blue} /></View>}
      <View style={{ padding: 18, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Title style={{ fontSize: 22 }}>{vehicleName(v)}</Title><Body>{categoryFor(v.type).label} · {v.licensePlate} · {v.year}</Body></View><Badge tone={(v.type === 'HELICOPTER' ? aircraftVisibility(v.aircraftHosting).ready : v.isVerified) ? 'green' : 'amber'}>{v.type === 'HELICOPTER' ? aircraftVisibility(v.aircraftHosting).label : v.isVerified ? 'RC verified' : v.rcUrl ? 'RC in review' : 'RC needed'}</Badge></Row>
        <Body>{v.type === 'HELICOPTER' ? `${v.seats} passenger seats · Operator flown` : `${v.transmission} · ${v.fuelType} · ${v.seats} seats`}</Body>
        {v.type === 'HELICOPTER' && <Notice>{money(v.aircraftHosting?.pricePerHour, v.aircraftHosting?.currency)} / hour indicative · {aircraftVisibility(v.aircraftHosting).visible ? 'Published for enquiries' : 'Not published'}. Final prices come from operator quotes.</Notice>}
        {listings.filter((l) => l.vehicleId === v.id).map((l) => <Pressable key={l.id} onPress={() => setListing({ vehicle: v, listing: l })} accessibilityRole="button" accessibilityLabel={`Manage ${vehicleName(v)} listing`} style={{ backgroundColor: c.bg, borderRadius: 12, padding: 13, gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}><Label>{money(l.pricePerDay, l.currency)} / day</Label><Badge tone={l.isActive ? 'green' : 'gray'}>{l.isActive ? 'Live' : 'Paused'}</Badge></Row>
          <Body>{l.location} · {shortDate(l.availableFrom)} – {shortDate(l.availableTo)}</Body><Row><Text style={{ color: c.blue, fontWeight: '700', fontSize: 12 }}>Manage listing</Text><Icon name="arrow-forward" size={15} color={c.blue} /></Row>
        </Pressable>)}
        {v.type === 'HELICOPTER' ? <Button icon="airplane-outline" onPress={() => setAircraft(v)}>Charter setup</Button> : <Row style={{ flexWrap: 'wrap' }}><Button secondary icon="create-outline" onPress={() => setEditor(v)}>Edit vehicle</Button>{!v.isVerified && <Button secondary icon="document-text-outline" onPress={() => setRcVehicle(v)}>Upload RC</Button>}{v.isVerified && resources.listings?.loaded && !listings.some((l) => l.vehicleId === v.id) && <Button icon="add" onPress={() => setListing({ vehicle: v })}>New listing</Button>}</Row>}
      </View>
    </Card>)}
    {!visible.length && !resources.vehicles?.error && <Empty title={search || filter !== 'all' || category !== 'all' ? 'No matching vehicles' : 'Your fleet starts here'} text="Choose a category, add vehicle details and complete its verification before publishing." action="Add a vehicle" onAction={() => setEditor({})} />}
    {editor && <VehicleEditor key={editor.id || 'new'} vehicle={editor} onClose={() => setEditor(null)} onDone={async () => { setEditor(null); setNotice('Vehicle saved. Check its RC status before publishing.'); await refresh(); }} />}
    {listing && <ListingEditor {...listing} onClose={() => setListing(null)} onDone={async () => { setListing(null); setNotice('Listing saved. Existing reservations retain their agreed price and dates.'); await refresh(); }} />}
    {rcVehicle && <RcEditor vehicle={rcVehicle} onClose={() => setRcVehicle(null)} onDone={async (message) => { setRcVehicle(null); setNotice(message); await refresh(); }} />}
    {aircraft && <AircraftSetup vehicle={vehicles.find((v) => v.id === aircraft.id) || aircraft} onClose={() => setAircraft(null)} onChanged={refresh} />}
  </View>;
}

function Compliance({ checked, setChecked }) {
  return <View style={{ gap: 12 }}><Body>Review the listing terms before continuing. Vehicle approval is still required before your listing can go live.</Body><WebsiteButton path="/terms/listing">Read listing terms</WebsiteButton><Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setChecked(!checked)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}><Icon name={checked ? 'checkbox' : 'square-outline'} color={checked ? c.blue : c.muted} /><Body style={{ flex: 1 }}>I have read and accept the listing terms.</Body></Pressable></View>;
}
async function acceptTerms() {
  await api.post('/verifications/policies/accept', { policyType: 'LISTING_TERMS' });
}
function VehicleEditor({ vehicle, onClose, onDone }) {
  const { resources } = useHost();
  const [form, setForm] = useState({ make: '', model: '', licensePlate: '', type: 'CAR', fuelType: 'Petrol', transmission: 'Manual', images: [], operatorName: '', operatorPermitNumber: '', baseAirport: '', pricePerHour: '', ...vehicle, year: String(vehicle.year || ''), seats: String(vehicle.seats || 5) });
  const isAircraft = form.type === 'HELICOPTER';
  const category = categoryFor(form.type);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = (key) => ({ value: form[key], onChangeText: (value) => setForm((old) => ({ ...old, [key]: value })) });
  const needsTerms = !vehicle.id && !resources.policies?.data?.status?.LISTING_TERMS;
  const addImage = async (camera) => {
    setBusy(true); setError('');
    try {
      const asset = await choosePhoto(camera, false);
      if (!asset) return;
      const result = await upload('/vehicles/upload-image', 'image', asset);
      setForm((old) => ({ ...old, images: [...old.images, result.data.url] }));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const body = vehiclePayload(form);
      if (needsTerms) { if (!accepted) throw new Error('Read and accept the listing terms first.'); await acceptTerms(); }
      if (vehicle.id) { const editable = { ...body }; delete editable.licensePlate; await api.put(`/vehicles/${vehicle.id}`, editable); }
      else await api.post('/vehicles', body);
      await onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Sheet visible title={vehicle.id ? `Edit ${category.label.toLowerCase()}` : 'Add a vehicle'} onClose={() => { if (!busy) onClose(); }}>
    {error ? <Notice error>{error}</Notice> : null}
    {!vehicle.id && <><Label>Hosting category</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>{HOSTING_CATEGORIES.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`Host a ${item.label.toLowerCase()}`} accessibilityState={{ selected: item.key === form.type }} disabled={busy} onPress={() => setForm({ ...form, type: item.key, seats: item.seats, fuelType: item.fuel, transmission: item.transmission })} style={{ width: '47%', padding: 16, backgroundColor: item.key === form.type ? c.pale : c.white, borderWidth: 1, borderColor: item.key === form.type ? c.blue : c.line, borderRadius: 14, gap: 9 }}><Icon name={item.icon} size={28} color={c.blue} /><Label>{item.label}</Label></Pressable>)}</View></>}
    <Field label="Make" placeholder={isAircraft ? 'e.g. Bell' : form.type === 'CAR' ? 'e.g. Hyundai' : 'e.g. Honda'} {...field('make')} maxLength={60} />
    <Field label="Model" placeholder={isAircraft ? 'e.g. 407' : form.type === 'SCOOTER' ? 'e.g. Activa' : form.type === 'BIKE' ? 'e.g. CB350' : 'e.g. i20 Sportz'} {...field('model')} maxLength={60} />
    <Field label={isAircraft ? 'Aircraft registration' : 'Registration number'} placeholder={isAircraft ? 'e.g. VT-ABC' : 'e.g. KA01AB1234'} {...field('licensePlate')} autoCapitalize="characters" editable={!vehicle.id} maxLength={20} />
    <Row><View style={{ flex: 1 }}><Field label="Manufacturing year" placeholder="YYYY" {...field('year')} keyboardType="number-pad" maxLength={4} /></View><View style={{ flex: 1 }}><Field label={isAircraft ? 'Passenger seats' : 'Seats'} {...field('seats')} keyboardType="number-pad" maxLength={2} /></View></Row>
    {isAircraft ? <><Notice>Operator-led charter enquiries, priced per hour. Add passenger seats excluding crew. Documents and platform operator review are required before publication.</Notice><Field label="Operator company name" {...field('operatorName')} maxLength={160} /><Field label="Operator permit reference" {...field('operatorPermitNumber')} maxLength={120} /><Field label="Base airport / helipad" {...field('baseAirport')} maxLength={200} /><Field label="Indicative hourly rate (INR)" {...field('pricePerHour')} keyboardType="decimal-pad" /></> : <><Label>Fuel</Label><Chips selected={form.fuelType} onChange={(fuelType) => setForm({ ...form, fuelType })} options={['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'].map((key) => ({ key, label: key }))} /><Label>Transmission</Label><Chips selected={form.transmission} onChange={(transmission) => setForm({ ...form, transmission })} options={['Manual', 'Automatic'].map((key) => ({ key, label: key }))} /></>}
    <Section title={`Vehicle photos (${form.images.length}/10)`} />
    <Row style={{ flexWrap: 'wrap' }}>{form.images.map((url, index) => <Pressable key={`${index}-${url}`} disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => setForm({ ...form, images: form.images.filter((_, i) => i !== index) })}><Image source={{ uri: imageUrl(url) }} style={{ width: 90, height: 70, borderRadius: 10 }} /><View style={{ position: 'absolute', top: 3, right: 3, borderRadius: 10, backgroundColor: c.white }}><Icon name="close-circle" size={20} /></View></Pressable>)}</Row>
    <Row><Button secondary icon="images-outline" busy={busy} disabled={form.images.length >= 10} onPress={() => addImage(false)}>Choose photo</Button>{Platform.OS !== 'web' && <Button secondary icon="camera-outline" busy={busy} disabled={form.images.length >= 10} onPress={() => addImage(true)}>Camera</Button>}</Row>
    <Body>JPG, PNG or WEBP · Up to 5 MB each. Tap a photo to remove it.</Body>
    {needsTerms && <Compliance checked={accepted} setChecked={setAccepted} />}
    <Button icon="checkmark" busy={busy} disabled={needsTerms && !accepted} onPress={save}>Save {category.label.toLowerCase()}</Button>
    {!vehicle.id && <Body>{isAircraft ? 'After saving, open Charter setup to upload aircraft and operator documents.' : 'After saving, upload the RC from your fleet card. The vehicle stays unlisted until it is approved.'}</Body>}
  </Sheet>;
}
function RcEditor({ vehicle, onClose, onDone }) {
  const [asset, setAsset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choose = async (camera) => { try { const selected = await choosePhoto(camera, true); if (selected) setAsset(selected); setError(''); } catch (err) { setError(err.message); } };
  const submit = async () => {
    setBusy(true); setError('');
    try { const result = await upload('/verifications/rc/upload', 'rcImage', asset, { licensePlate: vehicle.licensePlate }); await onDone(result.message || 'RC submitted for review.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Sheet visible title="Registration certificate" onClose={() => { if (!busy) onClose(); }}>
    <Title style={{ fontSize: 21 }}>{vehicleName(vehicle)}</Title><Body>{vehicle.licensePlate}</Body>
    <Notice>Upload a clear, readable RC photo. Your approval status comes from the verification service; uploading alone does not mean approval.</Notice>
    {error ? <Notice error>{error}</Notice> : null}
    {asset && <Image source={{ uri: asset.uri }} resizeMode="contain" style={{ width: '100%', height: 240, borderRadius: 12 }} />}
    <Button secondary disabled={busy} icon="images-outline" onPress={() => choose(false)}>Choose RC photo</Button>
    {Platform.OS !== 'web' && <Button secondary disabled={busy} icon="camera-outline" onPress={() => choose(true)}>Photograph RC</Button>}
    <Body>JPG, PNG or WEBP · Up to 8 MB. PDF is not supported.</Body>
    <Button disabled={!asset} busy={busy} onPress={submit}>Submit RC for verification</Button>
  </Sheet>;
}
function ListingEditor({ vehicle, listing, onClose, onDone }) {
  const { resources } = useHost();
  const [price, setPrice] = useState(String(listing?.pricePerDay || ''));
  const [location, setLocation] = useState(listing?.location || '');
  const [description, setDescription] = useState(listing?.description || '');
  const [from, setFrom] = useState(listing?.availableFrom?.slice(0, 10) || dateKey());
  const [to, setTo] = useState(listing?.availableTo?.slice(0, 10) || '');
  const [active, setActive] = useState(listing?.isActive ?? true);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsTerms = !resources.policies?.data?.status?.LISTING_TERMS && active;
  const save = async () => {
    setBusy(true); setError('');
    try {
      if (!validRange(from, to)) throw new Error('Enter valid dates as YYYY-MM-DD, with the end after the start.');
      if (!Number.isFinite(Number(price)) || Number(price) < 0.01 || Number(price) > 1000000) throw new Error('Enter a valid daily price from 0.01 to 1,000,000.');
      if (!location.trim()) throw new Error('Enter the pickup location.');
      if (needsTerms) { if (!accepted) throw new Error('Read and accept the listing terms first.'); await acceptTerms(); }
      const body = { pricePerDay: Number(price), location: location.trim(), description, availableFrom: from, availableTo: to };
      if (listing) await api.patch(`/rentals/listings/${listing.id}`, { ...body, isActive: active });
      else await api.post('/rentals/listings', { ...body, vehicleId: vehicle.id, country: 'IN' });
      await onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Sheet visible title={listing ? 'Manage listing' : 'Publish a listing'} onClose={() => { if (!busy) onClose(); }}>
    <Title style={{ fontSize: 22 }}>{vehicleName(vehicle)}</Title><Body>{vehicle.licensePlate}</Body>
    {error ? <Notice error>{error}</Notice> : null}
    <Field label={`Your daily price (${listing?.currency || 'INR'})`} placeholder="e.g. 2000" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
    <Body>PickAndSync adds its platform fee to the guest total. Your existing booking prices stay unchanged.</Body>
    <Field label="Pickup city / area" placeholder="e.g. Indiranagar, Bengaluru" value={location} onChangeText={setLocation} maxLength={200} />
    <Field label="Available from (YYYY-MM-DD)" value={from} onChangeText={setFrom} maxLength={10} autoCapitalize="none" />
    <Field label="Available until (YYYY-MM-DD)" placeholder="YYYY-MM-DD" value={to} onChangeText={setTo} maxLength={10} autoCapitalize="none" />
    <Field label="Description" value={description} onChangeText={setDescription} placeholder="Pickup instructions and useful vehicle details" multiline maxLength={3000} />
    {listing && <><Label>Listing visibility</Label><Chips selected={active ? 'live' : 'paused'} onChange={(key) => setActive(key === 'live')} options={[{ key: 'live', label: 'Live' }, { key: 'paused', label: 'Paused' }]} /><Body>Pausing stops new requests. Existing reservations remain in your bookings.</Body></>}
    {needsTerms && <Compliance checked={accepted} setChecked={setAccepted} />}
    <Button busy={busy} disabled={needsTerms && !accepted} icon={active ? 'checkmark-circle-outline' : 'pause-circle-outline'} onPress={save}>{listing ? 'Save listing' : 'Publish listing'}</Button>
  </Sheet>;
}
