import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import AnimatedSplash from './components/AnimatedSplash';
import AppHeader from './src/components/AppHeader';
import BottomNav from './src/components/BottomNav';
import { api } from './src/api';
import { loadRefreshToken, saveRefreshToken } from './src/session';
import { addNotificationResponseListener, registerForPush } from './src/push';
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
    if (!screens[next]) return;
    // Tapping the tab you are on scrolls back to the top.
    if (next === tabRef.current) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
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

  // Each screen opens with a short fade and lift.
  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [tab, enter]);

  // Pull to refresh: a screen with data hands over its reload function. The control stays mounted
  // and is only switched on or off — adding or removing it re-creates the scroll view and wipes the screen.
  const refresher = useRef(null);
  const [canRefresh, setCanRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const registerRefresh = useCallback((fn) => {
    refresher.current = fn;
    setCanRefresh(true);
    return () => {
      if (refresher.current !== fn) return;
      refresher.current = null;
      setCanRefresh(false);
    };
  }, []);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresher.current?.();
    } catch {
      // The screen shows its own error.
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Register this device for push once signed in; tapping a notification opens the right tab.
  useEffect(() => {
    if (user) registerForPush();
  }, [user]);
  useEffect(() => addNotificationResponseListener((nextTab) => setTab(nextTab)), [setTab]);

  const clearDeepLink = useCallback(() => setDeepLinkOrderId(null), []);
  const Screen = screens[tab];
  const waitingForSession = restoring && !user && signedInScreens.includes(tab);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={booted ? 'dark' : 'light'} />
        <AppHeader activeTab={tab} setTab={setTab} layout={layout} user={user} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl enabled={canRefresh} refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue]} tintColor={colors.blue} />}
          >
            <Animated.View
              style={[
                styles.content,
                { maxWidth: layout.contentMaxWidth, paddingHorizontal: layout.gutter, paddingTop: layout.sectionGap, paddingBottom: layout.tablet ? 42 : 28 },
                { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
              ]}
            >
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
                  registerRefresh={registerRefresh}
                />
              )}
            </Animated.View>
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
