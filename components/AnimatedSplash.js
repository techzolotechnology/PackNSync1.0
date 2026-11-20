// AnimatedSplash.js — React Native (Expo) animated in-app splash.
// Uses only the built-in Animated API (no new dependencies):
// pin image scale-pops while a gold dot orbits on a ring.
//
// Static platform splash: export assets/splash-pin.svg to PNG (1024x1024)
// and set in app.json:
//   "splash": { "image": "./assets/splash.png", "backgroundColor": "#0052ad" }
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';

export default function AnimatedSplash({ onDone, minMs = 2000 }) {
    const orbit = useRef(new Animated.Value(0)).current;
    const pop = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })).start();
        Animated.spring(pop, { toValue: 1, friction: 5, delay: 300, useNativeDriver: true }).start();
        const t = setTimeout(() => {
            Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone && onDone());
        }, minMs);
        return () => clearTimeout(t);
    }, []);
    const spin = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <Animated.View style={[styles.wrap, { opacity: fade }]}>
            <View style={styles.markBox}>
                <Animated.View style={[styles.orbitRing, { transform: [{ rotate: spin }] }]}>
                    <View style={styles.orbitDot} />
                </Animated.View>
                <Animated.Image source={require('../assets/pin.png')} style={[styles.pin, { transform: [{ scale: pop }] }]} />
            </View>
            <Text style={styles.word}>PickAndSync</Text>
            <Text style={styles.tag}>Pack up. Sync up. Go.</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0066d6', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
    markBox: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
    orbitRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
    orbitDot: { position: 'absolute', top: -6, left: 66, width: 14, height: 14, borderRadius: 7, backgroundColor: '#f5b800' },
    pin: { width: 90, height: 90, resizeMode: 'contain' },
    word: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 28 },
    tag: { color: 'rgba(255,255,255,0.75)', fontSize: 14, letterSpacing: 1.5, marginTop: 8 },
});
