import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { useHost } from '../data';
import { money, shortDate, vehicleName } from '../model';
import { Badge, Body, Button, Card, Chips, Empty, Field, Label, Notice, Row, Sheet, Title } from '../ui';

export default function CharterInquiries() {
  const { resources, refresh } = useHost();
  const [filter, setFilter] = useState('NEW');
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inquiries = (resources.charters?.data || []).filter((i) => filter === 'all' || i.status === filter);
  const respond = async (status) => {
    setBusy(true); setError('');
    try {
      if (status === 'QUOTED' && (!Number.isFinite(Number(amount)) || Number(amount) < 1)) throw new Error('Enter the full charter quote amount.');
      if (status === 'QUOTED' && note.trim().length < 10) throw new Error('Include conditions and how the customer should confirm with you (at least 10 characters).');
      await api.patch(`/aviation/inquiries/${selected.id}/respond`, { status, quotedAmount: Number(amount), quoteNote: note });
      setSelected(null); await refresh(); setMessage(status === 'QUOTED' ? 'Quote sent. This does not book or charge for a flight.' : 'Enquiry declined.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <View>
    <Notice>Charter enquiries are separate from road rentals. Quotes do not confirm flights or move wallet funds. Arrange flight confirmation and operational checks with the customer.</Notice>
    {resources.charters?.error ? <Notice error>{resources.charters.error}</Notice> : null}{message ? <Notice>{message}</Notice> : null}
    <Chips selected={filter} onChange={setFilter} options={[{ key: 'NEW', label: 'New enquiries' }, { key: 'QUOTED', label: 'Quoted' }, { key: 'all', label: 'All enquiries' }]} />
    {inquiries.map((inquiry) => <Card key={inquiry.id}>
      <Row style={{ justifyContent: 'space-between' }}><Title style={{ fontSize: 20 }}>{vehicleName(inquiry.aircraft?.vehicle)}</Title><Badge>{inquiry.status}</Badge></Row>
      <Label style={{ marginTop: 15 }}>{inquiry.requester?.name || 'Guest'} · {inquiry.passengers} passengers</Label><Body>{inquiry.origin} → {inquiry.destination}</Body><Body>{shortDate(inquiry.requestedDate)}</Body>{inquiry.notes ? <Body>{inquiry.notes}</Body> : null}
      {inquiry.quotedAmount ? <Body>Full quote: {money(inquiry.quotedAmount, inquiry.aircraft?.currency)}</Body> : null}{inquiry.quoteNote ? <Body>{inquiry.quoteNote}</Body> : null}
      {inquiry.status === 'NEW' && <Button style={{ marginTop: 16 }} onPress={() => { setSelected(inquiry); setAmount(''); setNote(''); setError(''); }}>Quote or decline</Button>}
    </Card>)}
    {!inquiries.length && !resources.charters?.error && <Empty icon="airplane-outline" title="No matching charter enquiries" text="Publish an aircraft after operator review. Customers can then request a quote from the helicopter charter directory." />}
    <Sheet visible={!!selected} title="Respond to charter enquiry" onClose={() => { if (!busy) setSelected(null); }}>
      {error ? <Notice error>{error}</Notice> : null}<Body>{selected?.origin} → {selected?.destination} · {shortDate(selected?.requestedDate)}</Body>
      <Field label="Full charter quote (INR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Field label="Quote conditions / explanation" value={note} onChangeText={setNote} multiline maxLength={2000} />
      <Body>Include what the price covers and the next steps for confirming with your operator.</Body>
      <Button busy={busy} onPress={() => respond('QUOTED')}>Send quote</Button><Button secondary danger disabled={busy} onPress={() => respond('DECLINED')}>Decline enquiry</Button>
    </Sheet>
  </View>;
}
