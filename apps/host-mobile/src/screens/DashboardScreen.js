import { Text, View } from 'react-native';
import { useHost } from '../data';
import { money, schedule, shortDate, vehicleName } from '../model';
import { Badge, Body, Button, c, Card, Empty, Icon, Label, Notice, Row, Section, Title } from '../ui';

export default function DashboardScreen({ user, navigate }) {
  const { resources: r } = useHost();
  const bookings = r.bookings?.data || [];
  const pending = bookings.filter((b) => b.status === 'PENDING');
  const charterPending = (r.charters?.data || []).filter((i) => i.status === 'NEW');
  const next = schedule(bookings).slice(0, 3);
  return <View>
    <Row style={{ justifyContent: 'space-between', marginTop: 5, marginBottom: 24 }}><View style={{ flex: 1 }}><Body>Hello, {user.name?.split(' ')[0] || 'host'}</Body><Title style={{ fontSize: 32, marginTop: 5 }}>Ready for the next journey.</Title></View><View style={{ backgroundColor: c.amberBg, borderRadius: 16, padding: 13 }}><Icon name="sunny-outline" size={27} color={c.amber} /></View></Row>
    <Card style={{ backgroundColor: c.navy, borderColor: c.navy, padding: 23, overflow: 'hidden' }}>
      <Row style={{ justifyContent: 'space-between' }}><Text style={{ color: '#b9cfdf', fontSize: 12, fontWeight: '700', letterSpacing: 1.4 }}>YOUR HOSTING, IN SYNC</Text><Icon name="key-outline" color={c.yellow} size={24} /></Row>
      <Title style={{ color: c.white, fontSize: 28, lineHeight: 34, marginTop: 23 }}>Good journeys start{'\n'}with a great host.</Title>
      <Body style={{ color: '#b9cfdf', marginTop: 10, marginBottom: 23 }}>Keep your fleet ready. We’ll keep the details together.</Body>
      <Button icon="car-sport-outline" onPress={() => navigate('Fleet')} style={{ alignSelf: 'flex-start' }}>Manage my fleet</Button>
    </Card>
    <Row style={{ alignItems: 'stretch' }}>
      <Metric label="Vehicles in your fleet" value={r.vehicles?.loaded ? String(r.vehicles.data.length) : '—'} icon="car-sport-outline" />
      <Metric label="Awaiting your reply" value={r.bookings?.loaded && r.charters?.loaded ? String(pending.length + charterPending.length) : '—'} icon="chatbox-ellipses-outline" yellow />
    </Row>
    <Row style={{ alignItems: 'stretch' }}>
      <Metric label="Upcoming earnings" value={money(r.earnings?.data?.upcoming)} icon="time-outline" />
      <Metric label="Cash in wallet" value={money(r.wallet?.data?.balance, r.wallet?.data?.currency)} icon="wallet-outline" />
    </Row>
    {r.verification?.loaded && !r.verification.data.isFullyVerified && <Notice action="Complete host setup" onAction={() => navigate('Account')}>Your identity verification needs attention before you can publish a vehicle.</Notice>}
    {pending.length > 0 && <Card style={{ backgroundColor: c.amberBg, borderColor: '#f3e3af' }}><Row><Icon name="notifications-outline" color={c.amber} /><View style={{ flex: 1 }}><Label>{pending.length} request{pending.length === 1 ? '' : 's'} waiting</Label><Body>Review the dates and guest before accepting.</Body></View></Row><Button secondary onPress={() => navigate('Bookings')} style={{ marginTop: 15 }}>Review booking requests</Button></Card>}
    {(r.charters?.data || []).some((i) => i.status === 'NEW') && <Notice action="Review charter enquiries" onAction={() => navigate('Charters')}>New helicopter charter requests are waiting for an operator quote.</Notice>}
    <Section title="Next on your schedule" action="View calendar" onAction={() => navigate('Calendar')} />
    {next.length ? next.map((event) => <Card key={`${event.booking.id}-${event.kind}`}><Row><View style={{ width: 49, height: 52, backgroundColor: c.pale, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}><Icon name={event.kind === 'Pickup' ? 'arrow-up-outline' : 'arrow-down-outline'} color={c.blue} /></View><View style={{ flex: 1 }}><Label>{vehicleName(event.booking.listing.vehicle)}</Label><Body>{event.booking.renter?.name || 'Guest'} · {shortDate(event.date)}</Body></View><Badge tone={event.kind === 'Pickup' ? 'blue' : 'green'}>{event.kind}</Badge></Row></Card>) : <Empty icon="calendar-outline" title="A clear road ahead" text="Paid bookings will appear here with their scheduled pickup and return dates." />}
    <Body style={{ marginTop: 8 }}>Schedule dates are reservation dates. They do not confirm a physical handover or return.</Body>
  </View>;
}
function Metric({ label, value, icon, yellow }) {
  return <Card style={{ flex: 1, minWidth: 0, gap: 11 }}><View style={{ alignSelf: 'flex-start', backgroundColor: yellow ? c.amberBg : c.pale, borderRadius: 10, padding: 8 }}><Icon name={icon} size={20} color={yellow ? c.amber : c.blue} /></View><Title style={{ fontSize: 23 }}>{value}</Title><Body style={{ fontSize: 12, lineHeight: 17 }}>{label}</Body></Card>;
}
