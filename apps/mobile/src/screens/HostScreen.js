import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import RentalBusinessProfile from '../components/RentalBusinessProfile';
import { api } from '../api';
import { WEBSITE_URL } from '../backendConfig';
import { colors } from '../theme';
import { AppButton, Field, IconCircle, Notice, PageIntro, ResponsiveGrid, SectionHeader, SegmentedControl, Surface } from '../components/ui';
import { today } from '../utils/dates';
import { errorFeedback, successFeedback } from '../utils/haptics';

const TYPES = [
  { key: 'CAR', label: 'Car', icon: 'car-sport-outline' },
  { key: 'BIKE', label: 'Bike', icon: 'bicycle-outline' },
  { key: 'SCOOTER', label: 'Scooter', icon: 'speedometer-outline' },
];

const BENEFITS = [
  ['person-circle-outline', 'One account', 'Your website and app identity stay together.'],
  ['pricetag-outline', 'Clear pricing', 'Set a daily amount guests can understand.'],
  ['location-outline', 'Local pickup', 'Connect with travellers already planning nearby.'],
];

export default function HostScreen({ user, setTab, layout }) {
  const [type, setType] = useState('CAR');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [pricePerDay, setPricePerDay] = useState('2000');
  const [location, setLocation] = useState('Bangalore');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('gold');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const twoWheeler = type !== 'CAR';

  const publish = async () => {
    if (!user) return setTab('Account');
    if (!make.trim() || !model.trim() || !licensePlate.trim()) {
      errorFeedback();
      setTone('error');
      return setMessage('Add the make, model and licence plate first.');
    }
    setLoading(true);
    setMessage('');
    setNeedsVerification(false);
    try {
      const vehicle = await api.post('/vehicles', {
        make: make.trim(),
        model: model.trim(),
        licensePlate: licensePlate.trim().toUpperCase(),
        year: 2024,
        type,
        seats: twoWheeler ? 2 : 5,
        fuelType: 'Petrol',
        transmission: type === 'SCOOTER' ? 'Automatic' : 'Manual',
        images: [],
      });
      await api.post('/rentals/listings', {
        vehicleId: vehicle.data.id,
        pricePerDay,
        location,
        availableFrom: today,
        availableTo: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      successFeedback();
      setTone('success');
      setMessage('Vehicle listed successfully. Add photos and manage availability on the website.');
    } catch (error) {
      if (/verif|aadhaar|licen[cs]e|kyc/i.test(error.message)) setNeedsVerification(true);
      errorFeedback();
      setTone('error');
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <PageIntro eyebrow="HOST WITH PICKANDSYNC" icon="key" title="Put your vehicle to work." description="Create a clean listing that appears across the connected PickAndSync experience." layout={layout} />
      <RentalBusinessProfile user={user} />
      <View style={[styles.hostLayout, layout.tablet && styles.hostLayoutWide]}>
        <Surface style={styles.formSurface}>
          <SectionHeader title="Vehicle details" subtitle="Add the essentials now. You can manage availability through the platform." />
          <SegmentedControl options={TYPES} value={type} onChange={setType} />
          <ResponsiveGrid columns={layout.formColumns} gap={12}>
            <Field label="MAKE" icon="business-outline" value={make} onChangeText={setMake} placeholder={twoWheeler ? 'Royal Enfield' : 'Toyota'} autoCapitalize="words" />
            <Field label="MODEL" icon={twoWheeler ? 'bicycle-outline' : 'car-outline'} value={model} onChangeText={setModel} placeholder={twoWheeler ? 'Classic 350' : 'Innova'} autoCapitalize="words" />
            <Field label="LICENCE PLATE" icon="reader-outline" value={licensePlate} onChangeText={setLicensePlate} placeholder="KA01AB1234" autoCapitalize="characters" />
            <Field label="PRICE PER DAY (₹)" icon="cash-outline" value={pricePerDay} onChangeText={(v) => setPricePerDay(v.replace(/\D/g, ''))} placeholder="2000" keyboardType="number-pad" maxLength={6} />
            <Field label="PICKUP CITY" icon="location-outline" value={location} onChangeText={setLocation} placeholder="Bangalore" autoCapitalize="words" />
          </ResponsiveGrid>
          <AppButton icon="rocket-outline" onPress={publish} loading={loading}>{loading ? 'Publishing…' : 'Publish Listing'}</AppButton>
          <Notice tone={tone}>{message}</Notice>
          {needsVerification && (
            <AppButton variant="ghost" icon="shield-checkmark-outline" onPress={() => Linking.openURL(`${WEBSITE_URL}/verify`)}>Verify your ID on the website</AppButton>
          )}
        </Surface>
        <Surface style={[styles.sideSurface, layout.tablet && styles.sideSurfaceWide]}>
          <Text style={styles.sideEyebrow}>WHY HOST HERE?</Text>
          {BENEFITS.map(([icon, title, copy], index) => (
            <View key={title} style={[styles.benefit, index === BENEFITS.length - 1 && styles.benefitLast]}>
              <IconCircle name={icon} size={38} />
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
  sideSurface: { flex: 1, backgroundColor: colors.blueSoft, borderColor: colors.blueBorder },
  sideSurfaceWide: { minWidth: 270 },
  sideEyebrow: { color: colors.blueDark, fontWeight: '900', fontSize: 12, letterSpacing: 1.1, marginBottom: 7 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(157,206,242,0.65)' },
  benefitLast: { borderBottomWidth: 0 },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: colors.navy, fontWeight: '900', marginBottom: 2 },
  benefitText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
