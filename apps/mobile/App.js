import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import AnimatedSplash from './components/AnimatedSplash';
import AppHeader from './src/components/AppHeader';
import BottomNav from './src/components/BottomNav';
import { AccountScreen, HomeScreen, HostScreen, RentalsScreen } from './src/screens';
import { colors, createLayout } from './src/theme';

const screens = { Home: HomeScreen, Rentals: RentalsScreen, Host: HostScreen, Account: AccountScreen };

export default function App() {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => createLayout(width, height), [width, height]);
  const [tab, setTab] = useState('Home');
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);
  const Screen = screens[tab];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" backgroundColor={colors.white} />
        <AppHeader activeTab={tab} setTab={setTab} layout={layout} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={[styles.content, { maxWidth: layout.contentMaxWidth, paddingHorizontal: layout.gutter, paddingTop: layout.sectionGap, paddingBottom: layout.tablet ? 42 : 28 }]}>
              <Screen user={user} setUser={setUser} setTab={setTab} layout={layout} />
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
});
