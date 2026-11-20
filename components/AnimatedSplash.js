// AnimatedSplash.js — React Native (Expo) animated in-app splash.
// Uses only the built-in Animated API (no new dependencies):
// pin image scale-pops while a gold dot orbits on a ring.
//
// Static platform splash: export assets/splash-pin.svg to PNG (1024x1024)
// and set in app.json:
//   "splash": { "image": "./assets/splash.png", "backgroundColor": "#0052ad" }
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, SafeAreaView, StyleSheet, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function AnimatedSplash({ onDone, minMs = 2000 }) {
    const { width, height, fontScale } = useWindowDimensions();
    const compact = height < 400 || fontScale > 1.4;
    const markSize = Math.min(160, width * 0.55, height * (compact ? 0.32 : 0.45));
    const orbit = useRef(new Animated.Value(0)).current;
    const pop = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const spinning = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true }));
        const popping = Animated.spring(pop, { toValue: 1, friction: 5, delay: 300, useNativeDriver: true });
        const fading = Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true });
        spinning.start();
        popping.start();
        const timer = setTimeout(() => {
            fading.start(({ finished }) => { if (finished) onDone?.(); });
        }, minMs);
        return () => {
            clearTimeout(timer);
            spinning.stop();
            popping.stop();
            fading.stop();
        };
    }, [fade, minMs, onDone, orbit, pop]);
    const spin = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <SafeAreaView style={styles.screen}>
            <StatusBar style="light" />
            <Animated.View style={[styles.wrap, { opacity: fade }]}>
                <View style={[styles.markBox, { width: markSize, height: markSize }]}>
                    <Animated.View style={[styles.orbitRing, { transform: [{ rotate: spin }] }]}>
                        <View style={styles.orbitDot} />
                    </Animated.View>
                    <Animated.Image source={require('../assets/pin.png')} style={[styles.pin, { transform: [{ scale: pop }] }]} />
                </View>
                <Text style={[styles.word, compact && styles.wordCompact]}>PickAndSync</Text>
                <Text style={styles.tag}>Pack up. Sync up. Go.</Text>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#0066d6' },
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    markBox: { alignItems: 'center', justifyContent: 'center' },
    orbitRing: { position: 'absolute', width: '94%', height: '94%', borderRadius: 999, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
    orbitDot: { position: 'absolute', top: -6, left: '50%', marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#f5b800' },
    pin: { width: '56%', height: '56%', resizeMode: 'contain' },
    word: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 28, textAlign: 'center' },
    wordCompact: { marginTop: 12 },
    tag: { color: 'rgba(255,255,255,0.75)', fontSize: 14, letterSpacing: 1.5, marginTop: 8, textAlign: 'center' },
});
