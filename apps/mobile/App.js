import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import AnimatedSplash from './components/AnimatedSplash';
import AppHeader from './src/components/AppHeader';
import BottomNav from './src/components/BottomNav';
import { api } from './src/api';
import { loadRefreshToken, saveRefreshToken } from './src/session';
import { AccountScreen, BookingsScreen, HomeScreen, HostScreen, RentalsScreen, TripsScreen, WalletScreen } from './src/screens';
import { colors, createLayout } from './src/theme';

const screens = {
  Home: HomeScreen,
  Trips: TripsScreen,
  Rentals: RentalsScreen,
  Bookings: BookingsScreen,
  Wallet: WalletScreen,
  Account: AccountScreen,
  Host: HostScreen,
};
const signedInScreens = ['Bookings', 'Wallet', 'Account'];

// The website sends people back after a top-up with packandsync://wallet?order_id=...
function readAppLink(url) {
  const match = /^packandsync:\/\/([a-z]+)\/?(?:\?(.*))?$/i.exec(String(url || ''));
  if (!match) return null;
  const orderId = /(?:^|&)order_id=([^&#]+)/.exec(match[2] || '');
  return { screen: match[1].toLowerCase(), orderId: orderId ? decodeURIComponent(orderId[1]) : null };
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => createLayout(width, height), [width, height]);
  const [tab, setTabState] = useState('Home');
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [booted, setBooted] = useState(false);
  const [deepLinkOrderId, setDeepLinkOrderId] = useState(null);
  const tabRef = useRef('Home');
  const history = useRef([]);
  const scrollRef = useRef(null);
  const userRef = useRef(null);
  userRef.current = user;

  const setTab = useCallback((next) => {
    if (!screens[next] || next === tabRef.current) return;
    history.current = [...history.current.slice(-19), tabRef.current];
    tabRef.current = next;
    setTabState(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // Android back goes to the previous tab, then leaves the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const previous = history.current.pop();
      if (!previous) return false;
      tabRef.current = previous;
      setTabState(previous);
      return true;
    });
    return () => sub.remove();
  }, []);

  // Stay signed in: the refresh token lives in secure storage and is swapped on every refresh.
  // One attempt at a time: two refreshes with the same token would end the session.
  const restoring$ = useRef(null);
  const restoreSession = useCallback(() => {
    if (!restoring$.current) {
      restoring$.current = (async () => {
        const saved = await loadRefreshToken();
        if (!saved || userRef.current) return;
        try {
          const restored = await api.restore(saved);
          if (restored) setUser(restored);
        } catch {
          // Signed out elsewhere (the saved token is already cleared) or offline (kept for later).
        }
      })().finally(() => { restoring$.current = null; });
    }
    return restoring$.current;
  }, []);

  useEffect(() => {
    api.onRefreshTokenChange(saveRefreshToken);
    api.onSessionEnd(() => setUser(null));
    restoreSession().finally(() => setRestoring(false));
    // Opened offline? Try again whenever the app comes back to the front.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !userRef.current) restoreSession();
    });
    return () => sub.remove();
  }, [restoreSession]);

  useEffect(() => {
    const open = (url) => {
      const link = readAppLink(url);
      if (link?.screen !== 'wallet') return;
      setTab('Wallet');
      if (link.orderId) setDeepLinkOrderId(link.orderId);
    };
    Linking.getInitialURL().then(open).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => open(url));
    return () => sub.remove();
  }, [setTab]);

  const clearDeepLink = useCallback(() => setDeepLinkOrderId(null), []);
  const Screen = screens[tab];
  const waitingForSession = restoring && !user && signedInScreens.includes(tab);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" backgroundColor={colors.white} />
        <AppHeader activeTab={tab} setTab={setTab} layout={layout} user={user} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={[styles.content, { maxWidth: layout.contentMaxWidth, paddingHorizontal: layout.gutter, paddingTop: layout.sectionGap, paddingBottom: layout.tablet ? 42 : 28 }]}>
              {waitingForSession ? (
                <View style={styles.waiting}>
                  <ActivityIndicator color={colors.blue} size="large" />
                  <Text style={styles.waitingText}>Signing you in…</Text>
                </View>
              ) : (
                <Screen
                  user={user}
                  setUser={setUser}
                  setTab={setTab}
                  layout={layout}
                  deepLinkOrderId={deepLinkOrderId}
                  clearDeepLink={clearDeepLink}
                />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <BottomNav activeTab={tab} setTab={setTab} layout={layout} />
      </SafeAreaView>
      {!booted && <AnimatedSplash onDone={() => setBooted(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bluePale },
  safeArea: { flex: 1, backgroundColor: colors.bluePale },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { width: '100%', alignSelf: 'center' },
  waiting: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  waitingText: { color: colors.muted, fontWeight: '700' },
});
