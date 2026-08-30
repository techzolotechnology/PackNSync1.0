import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../api';
import { colors } from '../theme';
import { AppButton, Field, Notice, PageIntro, ResponsiveGrid, Surface } from '../components/ui';
import { today } from '../utils/dates';

export default function HostScreen({ user, setTab, layout }) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [pricePerDay, setPricePerDay] = useState('2000');
  const [location, setLocation] = useState('Bangalore');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const publish = async () => {
    if (!user) return setTab('Account');
    setLoading(true);
    setMessage('');
    try {
      const vehicle = await api.post('/vehicles', {
        make, model, licensePlate, year: 2024, type: 'CAR', seats: 5,
        fuelType: 'Petrol', transmission: 'Manual', images: [],
      });
      await api.post('/rentals/listings', {
        vehicleId: vehicle.data.id,
        pricePerDay,
        location,
        availableFrom: today,
        availableTo: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      setMessage('Vehicle listed successfully.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <PageIntro eyebrow="HOST WITH PICKANDSYNC" title="Put your vehicle to work." description="Create a clean listing that appears across the connected PickAndSync experience." layout={layout} />
      <View style={[styles.hostLayout, layout.tablet && styles.hostLayoutWide]}>
        <Surface style={styles.formSurface}>
          <Text style={styles.formTitle}>Vehicle details</Text>
          <Text style={styles.formSubtitle}>Add the essentials now. You can manage availability through the platform.</Text>
          <ResponsiveGrid columns={layout.formColumns} gap={12}>
            <Field label="MAKE" value={make} onChangeText={setMake} placeholder="Toyota" autoCapitalize="words" />
            <Field label="MODEL" value={model} onChangeText={setModel} placeholder="Innova" autoCapitalize="words" />
            <Field label="LICENSE PLATE" value={licensePlate} onChangeText={setLicensePlate} placeholder="KA01AB1234" autoCapitalize="characters" />
            <Field label="PRICE PER DAY" value={pricePerDay} onChangeText={setPricePerDay} placeholder="2000" keyboardType="number-pad" />
            <Field label="PICKUP CITY" value={location} onChangeText={setLocation} placeholder="Bangalore" autoCapitalize="words" />
          </ResponsiveGrid>
          <AppButton onPress={publish} disabled={loading}>{loading ? 'Publishing…' : 'Publish Listing'}</AppButton>
          <Notice>{message}</Notice>
        </Surface>
        <Surface style={[styles.sideSurface, layout.tablet && styles.sideSurfaceWide]}>
          <Text style={styles.sideEyebrow}>WHY HOST HERE?</Text>
          {[
            ['One account', 'Your website and app identity stay together.'],
            ['Clear pricing', 'Set a daily amount guests can understand.'],
            ['Local pickup', 'Connect with travellers already planning nearby.'],
          ].map(([title, copy], index) => (
            <View key={title} style={styles.benefit}>
              <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
              <View style={styles.benefitCopy}><Text style={styles.benefitTitle}>{title}</Text><Text style={styles.benefitText}>{copy}</Text></View>
            </View>
          ))}
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hostLayout: { gap: 14 },
  hostLayoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  formSurface: { flex: 2 },
  formTitle: { color: colors.navy, fontSize: 22, fontWeight: '900' },
  formSubtitle: { color: colors.muted, lineHeight: 21, marginTop: 5, marginBottom: 17 },
  sideSurface: { flex: 1, backgroundColor: colors.blueSoft, borderColor: colors.blueBorder },
  sideSurfaceWide: { minWidth: 270 },
  sideEyebrow: { color: colors.blueDark, fontWeight: '900', fontSize: 12, letterSpacing: 1.1, marginBottom: 7 },
  benefit: { flexDirection: 'row', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(157,206,242,0.65)' },
  number: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  numberText: { color: colors.blue, fontWeight: '900' },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: colors.navy, fontWeight: '900', marginBottom: 2 },
  benefitText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
