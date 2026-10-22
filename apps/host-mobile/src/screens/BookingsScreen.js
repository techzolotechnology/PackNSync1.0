import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { useHost } from '../data';
import { hostAmount, money, shortDate, vehicleName } from '../model';
import { Badge, Body, Button, c, Card, Chips, Empty, Field, Label, Notice, Row, Section, Sheet, Title } from '../ui';
import CharterInquiries from './CharterInquiries';

export default function BookingsScreen({ initialMode = 'rentals' }) {
  const [mode, setMode] = useState(initialMode);
  const { resources, refresh } = useHost();
  const [filter, setFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const bookings = resources.bookings?.data || [];
  const visible = bookings.filter((b) => (filter === 'all' || b.status === filter) && `${vehicleName(b.listing.vehicle)} ${b.renter?.name || ''} ${b.id}`.toLowerCase().includes(search.toLowerCase()));
  const decide = async () => {
    setBusy(true); setError('');
    try {
      await api.patch(`/rentals/bookings/${decision.booking.id}/respond`, { status: decision.status });
      setMessage(decision.status === 'CONFIRMED' ? 'Request accepted. The guest can now pay for their booking.' : 'Request declined. The guest has been notified.');
      setDecision(null);
      await refresh();
    } catch (err) { setError(err.message); await refresh(); } finally { setBusy(false); }
  };
  return <View>
    <Section title="Bookings & requests" /><Body style={{ marginBottom: 20 }}>Review every journey before handing over your keys.</Body>
    <Chips selected={mode} onChange={setMode} options={[{ key: 'rentals', label: 'Road rentals' }, { key: 'charters', label: 'Helicopter enquiries' }]} />
    {mode === 'charters' ? <CharterInquiries /> : <>
    {message ? <Notice>{message}</Notice> : null}
    <Field label="Find a booking" placeholder="Guest, car or booking ID" value={search} onChangeText={setSearch} />
    <Chips selected={filter} onChange={setFilter} options={[{ key: 'PENDING', label: `Requests (${bookings.filter((b) => b.status === 'PENDING').length})` }, { key: 'CONFIRMED', label: 'Awaiting payment' }, { key: 'PAID', label: 'Paid' }, { key: 'all', label: 'All bookings' }]} />
    {visible.map((booking) => <Card key={booking.id}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Title style={{ fontSize: 21 }}>{vehicleName(booking.listing.vehicle)}</Title><Body>{booking.listing.vehicle.licensePlate}</Body></View><Badge tone={booking.status === 'PAID' ? 'green' : booking.status === 'PENDING' ? 'amber' : 'gray'}>{statusLabel(booking.status)}</Badge></Row>
      <View style={{ backgroundColor: c.bg, borderRadius: 13, padding: 14, gap: 6, marginVertical: 16 }}><Label>{booking.renter?.name || 'Guest'}</Label><Body>{shortDate(booking.startDate)} – {shortDate(booking.endDate)} · {booking.listing.location}</Body></View>
      <Row style={{ justifyContent: 'space-between' }}><Body>Your booking amount</Body><Title style={{ fontSize: 21 }}>{money(hostAmount(booking), booking.listing.currency)}</Title></Row>
      <Body style={{ marginTop: 5, fontSize: 12 }}>Booking #{booking.id.slice(0, 8)} · Guest total {money(booking.totalPrice, booking.listing.currency)}</Body>
      {booking.status === 'PENDING' && <Row style={{ marginTop: 17 }}><Button secondary style={{ flex: 1 }} onPress={() => { setDecision({ booking, status: 'REJECTED' }); setError(''); }}>Decline</Button><Button style={{ flex: 1 }} icon="checkmark" onPress={() => { setDecision({ booking, status: 'CONFIRMED' }); setError(''); }}>Accept</Button></Row>}
      {booking.status === 'CONFIRMED' && <Body style={{ marginTop: 12, color: c.amber }}>Accepted · Waiting for guest payment before pickup.</Body>}
      {booking.status === 'PAID' && <Body style={{ marginTop: 12, color: c.green }}>Paid · Check your earnings for release status.</Body>}
    </Card>)}
    {!visible.length && !resources.bookings?.error && <Empty icon="file-tray-outline" title="You’re all caught up" text="Bookings matching this view will appear here. Pull down to refresh whenever you need." />}
    {decision && <Sheet visible title={decision.status === 'CONFIRMED' ? 'Accept this request?' : 'Decline this request?'} onClose={() => { if (!busy) setDecision(null); }}>
      {error ? <Notice error>{error}</Notice> : null}
      <Title style={{ fontSize: 23 }}>{vehicleName(decision.booking.listing.vehicle)}</Title><Body>{decision.booking.renter?.name} · {shortDate(decision.booking.startDate)} – {shortDate(decision.booking.endDate)}</Body>
      <Notice>{decision.status === 'CONFIRMED' ? 'Confirm that the vehicle is available for these dates. The guest will be notified and asked to pay.' : 'The guest will be notified that you cannot accept these dates.'}</Notice>
      <Button busy={busy} danger={decision.status === 'REJECTED'} onPress={decide}>{decision.status === 'CONFIRMED' ? 'Accept request' : 'Decline request'}</Button>
    </Sheet>}
    </>}
  </View>;
}
export const statusLabel = (status) => ({ PENDING: 'Request', CONFIRMED: 'Accepted', PAID: 'Paid', CANCELLED: 'Cancelled', REJECTED: 'Declined' }[status] || status);
