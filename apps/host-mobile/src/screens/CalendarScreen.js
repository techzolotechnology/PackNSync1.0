import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useHost } from '../data';
import { dateKey, schedule, shortDate, vehicleName } from '../model';
import { Badge, Body, Button, c, Card, Chips, Empty, IconButton, Label, Notice, Row, Section, Title } from '../ui';

export default function CalendarScreen({ navigate }) {
  const { resources } = useHost();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(dateKey());
  const [kind, setKind] = useState('all');
  const events = schedule(resources.bookings?.data || [], new Date(2000, 0, 1));
  const displayed = events.filter((e) => dateKey(e.date) === selected && (kind === 'all' || e.kind === kind));
  const offset = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const move = (amount) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  return <View>
    <Section title="Your schedule" /><Body style={{ marginBottom: 20 }}>Paid reservations, with pickups and returns at a glance.</Body>
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: 15 }}><IconButton name="chevron-back" label="Previous month" onPress={() => move(-1)} /><Title style={{ fontSize: 19 }}>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Title><IconButton name="chevron-forward" label="Next month" onPress={() => move(1)} /></Row>
      <View style={{ flexDirection: 'row' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={index} style={{ width: `${100 / 7}%`, textAlign: 'center', color: c.muted, fontSize: 12, marginBottom: 12 }}>{day}</Text>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
        const day = index - offset + 1;
        if (day < 1 || day > count) return <View key={index} style={{ width: `${100 / 7}%`, height: 49 }} />;
        const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
        const marked = events.some((e) => dateKey(e.date) === key);
        const active = selected === key;
        return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${key}${marked ? ', scheduled activity' : ''}`} accessibilityState={{ selected: active }} onPress={() => setSelected(key)} style={{ width: `${100 / 7}%`, height: 49, alignItems: 'center', justifyContent: 'center' }}><View style={{ backgroundColor: active ? c.blue : key === dateKey() ? c.pale : 'transparent', borderRadius: 12, width: 38, height: 40, alignItems: 'center', justifyContent: 'center', gap: 4 }}><Text style={{ color: active ? c.white : c.text, fontWeight: active ? '800' : '500' }}>{day}</Text>{marked && <View style={{ width: 4, height: 4, borderRadius: 3, backgroundColor: active ? c.yellow : c.blue }} />}</View></Pressable>;
      })}</View>
      <Button secondary onPress={() => { setSelected(dateKey()); setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }} style={{ marginTop: 13 }}>Go to today</Button>
    </Card>
    <Section title={shortDate(`${selected}T12:00:00`)} />
    <Chips selected={kind} onChange={setKind} options={[{ key: 'all', label: 'All activity' }, { key: 'Pickup', label: 'Pickups' }, { key: 'Return', label: 'Returns' }]} />
    {displayed.map((event) => <Card key={`${event.booking.id}-${event.kind}`}><Row style={{ justifyContent: 'space-between' }}><Badge tone={event.kind === 'Pickup' ? 'blue' : 'green'}>{event.kind}</Badge><Body>#{event.booking.id.slice(0, 8)}</Body></Row><Title style={{ fontSize: 22, marginTop: 12 }}>{vehicleName(event.booking.listing.vehicle)}</Title><Label style={{ marginTop: 5 }}>{event.booking.renter?.name || 'Guest'}</Label><Body style={{ marginTop: 6 }}>{event.booking.listing.location}</Body><Button secondary style={{ marginTop: 15 }} onPress={() => navigate('Bookings')}>Open bookings</Button></Card>)}
    {!displayed.length && <Empty icon="calendar-clear-outline" title="Nothing scheduled" text="No paid pickup or return is scheduled for this date." />}
    <Notice>These are scheduled dates, not recorded handovers. Coordinate the exact pickup time and condition checks with the guest.</Notice>
  </View>;
}
