import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '../api';
import { useHost } from '../data';
import { money, shortDate } from '../model';
import { Badge, Body, Button, c, Card, Empty, Icon, Label, Notice, Row, Section } from '../ui';

export default function InboxScreen({ navigate }) {
  const { resources, refresh } = useHost();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('updates');
  const notifications = resources.notifications?.data || [];
  const readAll = async () => { setBusy(true); try { await api.put('/notifications/read-all', {}); await refresh(); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const open = async (notification) => {
    try { await api.put(`/notifications/${notification.id}/read`, {}); await refresh(); } catch (err) { setError(err.message); }
    if (notification.data?.charterInquiryId) navigate('Charters');
    else if (notification.data?.bookingId) navigate('Bookings');
    else if (notification.type === 'PAYMENT_RECEIVED') navigate('Earnings');
  };
  return <View><Section title="Updates & activity" /><Row style={{ marginBottom: 15 }}><Button secondary={tab !== 'updates'} onPress={() => setTab('updates')}>Updates</Button><Button secondary={tab !== 'wallet'} onPress={() => setTab('wallet')}>Wallet activity</Button></Row>
    {error ? <Notice error>{error}</Notice> : null}
    {tab === 'updates' ? <><Button secondary busy={busy} icon="checkmark-done-outline" onPress={readAll} style={{ marginBottom: 20 }}>Mark all as read</Button>{notifications.map((n) => <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${n.isRead ? '' : 'Unread: '}${n.title}`} onPress={() => open(n)}><Card style={!n.isRead && { borderColor: '#a9d0ff', backgroundColor: '#f6faff' }}><Row style={{ alignItems: 'flex-start' }}><Icon name={n.type === 'PAYMENT_RECEIVED' ? 'wallet-outline' : 'notifications-outline'} color={c.blue} /><View style={{ flex: 1 }}><Label>{n.title}</Label><Body style={{ marginTop: 5 }}>{n.body}</Body><Body style={{ fontSize: 12, marginTop: 8 }}>{shortDate(n.createdAt)}</Body></View>{!n.isRead && <Badge>New</Badge>}</Row></Card></Pressable>)}{!notifications.length && <Empty icon="notifications-outline" title="No updates yet" text="Booking decisions, payment updates and account messages appear here." />}</> : <>
      {resources.transactions?.error && <Notice error>{resources.transactions.error}</Notice>}
      {(resources.transactions?.data || []).map((tx) => <Card key={tx.id}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label>{tx.description || tx.type}</Label><Body>{shortDate(tx.createdAt)} · {tx.type}</Body></View><Label>{money(tx.amount, resources.wallet?.data?.currency)}</Label></Row><View style={{ marginTop: 12 }}><Badge tone={tx.status === 'SUCCESS' ? 'green' : tx.status === 'FAILED' ? 'red' : 'amber'}>{tx.status}</Badge></View></Card>)}
      {!resources.transactions?.data?.length && !resources.transactions?.error && <Empty icon="receipt-outline" title="No wallet activity yet" text="Released earnings, withdrawals and other wallet movements appear here." />}
    </>}
  </View>;
}
