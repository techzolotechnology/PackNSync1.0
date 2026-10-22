import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { api, setSessionEndHandler } from './src/api';
import { HostData, useHost } from './src/data';
import { Body, Button, c, Icon, IconButton, Label, Logo, Notice, Row, Title } from './src/ui';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import FleetScreen from './src/screens/FleetScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import EarningsScreen from './src/screens/EarningsScreen';
import AccountScreen from './src/screens/AccountScreen';
import InboxScreen from './src/screens/InboxScreen';

const tabs = [
  { key: 'Home', label: 'Home', icon: 'grid-outline', selected: 'grid' },
  { key: 'Fleet', label: 'Fleet', icon: 'car-sport-outline', selected: 'car-sport' },
  { key: 'Bookings', label: 'Bookings', icon: 'file-tray-full-outline', selected: 'file-tray-full' },
  { key: 'Calendar', label: 'Calendar', icon: 'calendar-outline', selected: 'calendar' },
  { key: 'Earnings', label: 'Earnings', icon: 'wallet-outline', selected: 'wallet' },
];
const CharterBookings = () => <BookingsScreen initialMode="charters" />;
const components = { Home: DashboardScreen, Fleet: FleetScreen, Bookings: BookingsScreen, Charters: CharterBookings, Calendar: CalendarScreen, Earnings: EarningsScreen, Account: AccountScreen, Inbox: InboxScreen };
const dependencies = { Home: ['vehicles', 'bookings', 'charters', 'earnings', 'wallet', 'verification'], Fleet: ['vehicles', 'listings'], Bookings: ['bookings'], Charters: ['charters'], Calendar: ['bookings'], Earnings: ['earnings', 'wallet'], Account: ['verification'], Inbox: ['notifications'] };

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  useEffect(() => { setSessionEndHandler(() => setUser(null)); return () => setSessionEndHandler(() => {}); }, []);
  const restore = useCallback(async () => {
    setBooting(true); setRestoreError('');
    try { setUser(await api.restore()); }
    catch (error) { if (error.status !== 401 && error.status !== 403) setRestoreError(error.message); }
    finally { setBooting(false); }
  }, []);
  useEffect(() => { restore(); }, [restore]);
  const signOut = async () => { setUser(null); setRestoreError(''); await api.signOut(); };
  return <SafeAreaProvider><SafeAreaView style={styles.safe}><StatusBar style="dark" />
    {booting ? <View style={styles.center}><Logo size={66} /><Title style={{ fontSize: 23, marginTop: 13 }}>PickAndSync Host</Title><ActivityIndicator style={{ marginTop: 20 }} color={c.blue} accessibilityLabel="Restoring your session" /></View> : restoreError ? <View style={[styles.center, { padding: 25 }]}><Logo size={60} /><Title style={{ marginVertical: 20 }}>Let’s reconnect.</Title><Notice error>{restoreError}</Notice><Button onPress={restore}>Retry saved sign-in</Button><Button secondary style={{ marginTop: 12 }} onPress={signOut}>Use another account</Button></View> : user ? <HostData key={user.id}><HostShell user={user} updateUser={setUser} onSignOut={signOut} /></HostData> : <AuthScreen onSignedIn={setUser} />}
  </SafeAreaView></SafeAreaProvider>;
}

function HostShell({ user, updateUser, onSignOut }) {
  const { resources, loading, refresh } = useHost();
  const [tab, setTab] = useState('Home');
  const scroll = useRef(null);
  const history = useRef([]);
  const positions = useRef({});
  const navigate = useCallback((next) => {
    if (!components[next]) return;
    setTab((previous) => { if (previous !== next) history.current.push(previous); return next; });
  }, []);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const previous = history.current.pop();
      if (previous) { setTab(previous); return true; }
      return false;
    });
    return () => handler.remove();
  }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: positions.current[tab] || 0, animated: false }); }, [tab]);
  // Refresh when returning from document verification or another application.
  useEffect(() => { const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); }); return () => sub.remove(); }, [refresh]);
  const Screen = components[tab];
  const pending = (resources.bookings?.data || []).filter((b) => b.status === 'PENDING').length + (resources.charters?.data || []).filter((i) => i.status === 'NEW').length;
  const activeTab = tab === 'Charters' ? 'Bookings' : tab;
  const unread = (resources.notifications?.data || []).filter((n) => !n.isRead).length;
  const failures = (dependencies[tab] || []).filter((key) => resources[key]?.error);
  const initial = loading && (dependencies[tab] || []).every((key) => !resources[key]?.loaded);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><Row><Logo size={35} /><View><Label>PickAndSync</Label><Text style={{ color: c.muted, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>HOST</Text></View></Row><Row><IconButton name="notifications-outline" label="Open updates" badge={unread} onPress={() => navigate('Inbox')} /><Pressable accessibilityRole="button" accessibilityLabel="Open host account" onPress={() => navigate('Account')} style={styles.avatar}><Text style={{ color: c.navy, fontSize: 16, fontWeight: '800' }}>{user.name?.slice(0, 1).toUpperCase() || 'H'}</Text></Pressable></Row></View>
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading && !initial} onRefresh={refresh} tintColor={c.blue} />} onScroll={(event) => { positions.current[tab] = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100}>
      {['Account', 'Inbox'].includes(tab) && <Pressable accessibilityRole="button" onPress={() => navigate('Home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, marginBottom: 8 }}><Icon name="arrow-back" size={18} color={c.blue} /><Text style={{ color: c.blue, fontWeight: '700' }}>Host dashboard</Text></Pressable>}
      {failures.length > 0 && <Notice error action="Try again" onAction={refresh}>{failures.length === 1 ? resources[failures[0]].error : 'Some account information could not load.'} {failures.some((key) => resources[key]?.loaded) ? 'Previously loaded information may be out of date.' : ''}</Notice>}
      {initial ? <View style={{ minHeight: 350, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.blue} size="large" /><Body style={{ marginTop: 15 }}>Loading your host dashboard…</Body></View> : <Screen key={tab} user={user} updateUser={updateUser} navigate={navigate} onSignOut={onSignOut} />}
    </ScrollView>
    <View style={styles.nav}>{tabs.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: item.key === activeTab }} onPress={() => navigate(item.key)} style={styles.navItem}><View style={[styles.navIcon, item.key === activeTab && { backgroundColor: c.pale }]}><Icon name={item.key === activeTab ? item.selected : item.icon} size={22} color={item.key === activeTab ? c.blue : c.muted} />{item.key === 'Bookings' && pending > 0 && <View style={styles.navDot} />}</View><Text style={{ color: item.key === activeTab ? c.blue : c.muted, fontSize: 10, fontWeight: item.key === activeTab ? '800' : '500' }}>{item.label}</Text></Pressable>)}</View>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.white, borderBottomWidth: 1, borderBottomColor: c.line },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: c.amberBg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 38, width: '100%', maxWidth: 760, alignSelf: 'center', flexGrow: 1 },
  nav: { flexDirection: 'row', backgroundColor: c.white, paddingTop: 6, paddingBottom: 8, borderTopWidth: 1, borderTopColor: c.line, justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 4, minHeight: 58 },
  navIcon: { minWidth: 49, height: 31, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  navDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, right: 9, top: 1, backgroundColor: c.red },
});
