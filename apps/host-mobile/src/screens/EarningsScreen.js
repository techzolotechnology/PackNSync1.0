import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { useHost } from '../data';
import { money, shortDate, vehicleName } from '../model';
import { Badge, Body, Button, c, Card, Chips, Empty, Field, Label, Notice, Row, Section, Sheet, Title } from '../ui';

export default function EarningsScreen({ user }) {
  const { resources, refresh } = useHost();
  const summary = resources.earnings?.data;
  const wallet = resources.wallet?.data;
  const [filter, setFilter] = useState('all');
  const [withdraw, setWithdraw] = useState(false);
  const [message, setMessage] = useState('');
  const earnings = (summary?.earnings || []).filter((e) => filter === 'all' || e.status === filter);
  return <View>
    <Section title="Earnings" /><Body style={{ marginBottom: 20 }}>Your account’s rental earnings, with pending and available amounts shown separately.</Body>
    {message ? <Notice>{message}</Notice> : null}
    <Card style={{ backgroundColor: c.navy, borderColor: c.navy, padding: 23 }}><Row style={{ justifyContent: 'space-between' }}><Label style={{ color: '#bdd0df' }}>Cash in your wallet</Label><Badge tone="green">INR wallet</Badge></Row><Title style={{ color: c.white, fontSize: 39, marginVertical: 20 }}>{money(wallet?.balance, wallet?.currency)}</Title><Body style={{ color: '#bdd0df', marginBottom: 18 }}>Released earnings and other cash in your PickAndSync wallet. Promo credits are excluded.</Body><Button icon="arrow-up-outline" disabled={!wallet || Number(wallet.balance) < 100 || !!resources.wallet?.error} onPress={() => setWithdraw(true)}>Withdraw funds</Button></Card>
    {wallet?.mockMode && <Notice>Payments are in test mode. Withdrawals do not send real money.</Notice>}
    <Row style={{ alignItems: 'stretch' }}><Card style={{ flex: 1 }}><Body>Pending release</Body><Title style={{ fontSize: 23, marginTop: 8 }}>{money(summary?.upcoming)}</Title></Card><Card style={{ flex: 1 }}><Body>On hold</Body><Title style={{ fontSize: 23, marginTop: 8 }}>{money(summary?.onHold)}</Title></Card></Row>
    <Card><Row style={{ justifyContent: 'space-between' }}><Body>Released to wallet</Body><Title style={{ fontSize: 22 }}>{money(summary?.released)}</Title></Row><Body style={{ marginTop: 8 }}>Released totals are historical earnings, not your current wallet balance. Cash may already have been spent or withdrawn.</Body></Card>
    <Section title="Rental earnings" />
    <Chips selected={filter} onChange={setFilter} options={[{ key: 'all', label: 'Latest earnings' }, { key: 'PENDING', label: 'Pending' }, { key: 'RELEASED', label: 'Released' }, { key: 'ON_HOLD', label: 'On hold' }]} />
    {earnings.map((earning) => <Card key={earning.id}><Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Label>{vehicleName(earning.booking?.listing?.vehicle)}</Label><Body style={{ marginTop: 5 }}>{shortDate(earning.booking?.startDate)} – {shortDate(earning.booking?.endDate)}</Body></View><Title style={{ fontSize: 22 }}>{money(earning.amount)}</Title></Row><Row style={{ marginTop: 14, justifyContent: 'space-between' }}><Badge tone={earning.status === 'RELEASED' ? 'green' : earning.status === 'ON_HOLD' ? 'amber' : 'gray'}>{({ PENDING: 'Pending release', RELEASED: 'Released', ON_HOLD: 'On hold', CANCELLED: 'Cancelled' })[earning.status] || earning.status}</Badge><Body>{earning.status === 'RELEASED' ? `Released ${shortDate(earning.releasedAt)}` : earning.status === 'PENDING' ? `Eligible ${shortDate(earning.releaseAt)}` : ''}</Body></Row>{earning.note && <Body style={{ marginTop: 12 }}>{earning.note}</Body>}</Card>)}
    {!earnings.length && !resources.earnings?.error && <Empty icon="wallet-outline" title="Your earnings will appear here" text="A host earning is recorded after a guest pays. The server controls release dates and any dispute holds." />}
    <Body style={{ fontSize: 12 }}>Showing up to 50 recent earning records. Summary totals include all your earning records.</Body>
    {withdraw && <WithdrawSheet user={user} wallet={wallet} onClose={() => setWithdraw(false)} onDone={async (result) => { setWithdraw(false); setMessage(result.mock ? 'Test withdrawal completed. No real money was transferred.' : result.data?.message || `Withdrawal ${result.data?.status || 'requested'}. Check your wallet activity for its status.`); await refresh(); }} />}
  </View>;
}
function WithdrawSheet({ user, wallet, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('upi');
  const [name, setName] = useState(user.name || '');
  const [upi, setUpi] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const validate = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 100 || value > Number(wallet.balance)) throw new Error('Enter at least ₹100, within your available cash balance.');
    if (!name.trim()) throw new Error('Enter the account holder’s name.');
    if (mode === 'upi' && !/^[\w.-]+@[\w.-]+$/.test(upi.trim())) throw new Error('Enter a valid UPI ID.');
    if (mode === 'bank' && (!/^\d{8,20}$/.test(account) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase()))) throw new Error('Check the bank account number and IFSC.');
    return { amount: value, mode, accountName: name.trim(), ...(mode === 'upi' ? { upiId: upi.trim() } : { accountNumber: account, ifsc: ifsc.trim().toUpperCase() }) };
  };
  const review = () => { try { validate(); setConfirmed(true); setError(''); } catch (err) { setError(err.message); } };
  const submit = async () => {
    setBusy(true); setError('');
    try { await onDone(await api.post('/wallet/withdraw', validate())); }
    catch (err) { setError(`${err.message} Check wallet activity before trying again if the connection was interrupted.`); setConfirmed(false); }
    finally { setBusy(false); }
  };
  return <Sheet visible title={confirmed ? 'Confirm withdrawal' : 'Withdraw funds'} onClose={() => { if (!busy) onClose(); }}>
    {error ? <Notice error>{error}</Notice> : null}
    {!wallet.payoutsReady && <Notice>Payouts are not connected yet. A request will hold the amount for manual processing by the PickAndSync team.</Notice>}
    {wallet.mockMode && <Notice>Test mode: this will not transfer real money.</Notice>}
    {confirmed ? <><Title>{money(amount)}</Title><Body>To {name}, {mode === 'upi' ? upi : `bank account ending ${account.slice(-4)}`}.</Body><Notice>The amount will leave your wallet when the request is submitted. Processing depends on your payout status.</Notice><Button busy={busy} onPress={submit}>Confirm {wallet.mockMode ? 'test ' : ''}withdrawal</Button><Button secondary disabled={busy} onPress={() => setConfirmed(false)}>Edit details</Button></> : <>
      <Body>Available cash: {money(wallet.balance)} · Minimum ₹100</Body>
      <Field label="Withdrawal amount (INR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Chips selected={mode} onChange={setMode} options={[{ key: 'upi', label: 'UPI' }, { key: 'bank', label: 'Bank account' }]} />
      <Field label="Account holder name" value={name} onChangeText={setName} />
      {mode === 'upi' ? <Field label="UPI ID" placeholder="name@bank" value={upi} onChangeText={setUpi} autoCapitalize="none" /> : <><Field label="Account number" value={account} onChangeText={setAccount} keyboardType="number-pad" /><Field label="IFSC" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" /></>}
      <Button onPress={review}>Review withdrawal</Button>
    </>}
  </Sheet>;
}
