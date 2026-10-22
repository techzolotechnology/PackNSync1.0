import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const c = { navy: '#10283f', blue: '#007bff', bg: '#f4f7fb', white: '#ffffff', text: '#172e43', muted: '#677b8e', line: '#e3eaf1', pale: '#eaf3ff', green: '#14765b', greenBg: '#e9f6ee', yellow: '#ffc84b', amber: '#916311', amberBg: '#fff6db', red: '#b74043', redBg: '#fff0ef' };
export const Icon = ({ name, size = 22, color = c.text }) => ['motorbike', 'scooter', 'helicopter'].includes(name)
  ? <MaterialCommunityIcons name={name} size={size} color={color} />
  : <Ionicons name={name} size={size} color={color} />;
export const Label = ({ children, style }) => <Text style={[s.label, style]}>{children}</Text>;
export const Body = ({ children, style }) => <Text style={[s.body, style]}>{children}</Text>;
export const Title = ({ children, style }) => <Text accessibilityRole="header" style={[s.title, style]}>{children}</Text>;
export const Row = ({ children, style }) => <View style={[s.row, style]}>{children}</View>;
export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
export function Button({ children, onPress, icon, secondary, danger, disabled, busy, style, accessibilityLabel }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, danger && { backgroundColor: c.redBg }, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] }, style]}>
    {busy ? <ActivityIndicator color={secondary ? c.blue : c.white} /> : icon ? <Icon name={icon} size={19} color={danger ? c.red : secondary ? c.text : c.white} /> : null}
    <Text style={[s.buttonText, secondary && { color: c.text }, danger && { color: c.red }]}>{children}</Text>
  </Pressable>;
}
export function IconButton({ name, label, onPress, badge = 0 }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.iconButton, pressed && { backgroundColor: c.pale }]}>
    <Icon name={name} />{badge > 0 && <View style={s.dot}><Text style={{ color: c.white, fontSize: 9, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</Text></View>}
  </Pressable>;
}
export function Badge({ children, tone = 'blue' }) {
  const themes = { blue: [c.pale, c.blue], green: [c.greenBg, c.green], amber: [c.amberBg, c.amber], red: [c.redBg, c.red], gray: [c.bg, c.muted] };
  const [backgroundColor, color] = themes[tone] || themes.gray;
  return <View style={[s.badge, { backgroundColor }]}><Text style={{ color, fontSize: 11, fontWeight: '700' }}>{children}</Text></View>;
}
export function Notice({ children, error, action, onAction }) {
  return <View accessibilityRole="alert" style={[s.notice, error && { backgroundColor: c.redBg }]}><Icon name={error ? 'alert-circle-outline' : 'information-circle-outline'} size={20} color={error ? c.red : c.blue} /><View style={{ flex: 1 }}><Body style={error && { color: c.red }}>{children}</Body>{action && <Pressable onPress={onAction} accessibilityRole="button" style={{ paddingVertical: 9 }}><Text style={s.link}>{action}</Text></Pressable>}</View></View>;
}
export function Field({ label, value, onChangeText, error, ...props }) {
  return <View style={{ gap: 7, marginBottom: 15 }}><Label>{label}</Label><TextInput accessibilityLabel={label} placeholderTextColor="#8b9aab" value={value} onChangeText={onChangeText} style={[s.input, props.multiline && { height: 100, textAlignVertical: 'top' }, error && { borderColor: c.red }]} {...props} />{error && <Body style={{ color: c.red }}>{error}</Body>}</View>;
}
export function Chips({ options, selected, onChange }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingRight: 8 }} style={{ flexGrow: 0, marginBottom: 14 }}>
    {options.map((o) => <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: selected === o.key }} onPress={() => onChange(o.key)} style={[s.chip, selected === o.key && { backgroundColor: c.navy, borderColor: c.navy }]}><Text style={{ color: selected === o.key ? c.white : c.muted, fontSize: 13, fontWeight: '600' }}>{o.label}</Text></Pressable>)}
  </ScrollView>;
}
export function Empty({ icon = 'car-sport-outline', title, text, action, onAction }) {
  return <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}><View style={s.iconWell}><Icon name={icon} size={32} color={c.blue} /></View><Title style={{ fontSize: 20, textAlign: 'center' }}>{title}</Title><Body style={{ textAlign: 'center', maxWidth: 340 }}>{text}</Body>{action && <Button icon="add" onPress={onAction}>{action}</Button>}</Card>;
}
export function Sheet({ visible, title, onClose, children }) {
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={s.overlay}><View accessibilityViewIsModal style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20), marginTop: Math.max(insets.top, 24) }]}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 10 }}><Title style={{ fontSize: 21, flex: 1 }}>{title}</Title><IconButton name="close" label="Close" onPress={onClose} /></Row>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, gap: 12 }}>{children}</ScrollView>
    </View></View>
  </Modal>;
}
export function Section({ title, action, onAction }) {
  return <Row style={{ justifyContent: 'space-between', marginTop: 10, marginBottom: 14 }}><Title style={{ fontSize: 19, flex: 1 }}>{title}</Title>{action && <Pressable onPress={onAction} accessibilityRole="button" style={{ padding: 8 }}><Text style={s.link}>{action}</Text></Pressable>}</Row>;
}
export const Logo = ({ size = 42 }) => <Image source={require('../assets/icon.png')} accessibilityLabel="PickAndSync" style={{ width: size, height: size, borderRadius: size * 0.25 }} />;
export function WebsiteButton({ path, children, icon = 'open-outline' }) {
  const { SITE_URL } = require('./config');
  return <Button secondary icon={icon} onPress={() => openLink(`${SITE_URL}${path}`)}>{children}</Button>;
}
export function openLink(url) {
  return Linking.openURL(url).catch(() => {});
}
export const s = StyleSheet.create({
  title: { color: c.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  body: { color: c.muted, fontSize: 14, lineHeight: 22 },
  label: { color: c.text, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { backgroundColor: c.white, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: c.line, marginBottom: 12 },
  button: { minHeight: 48, paddingVertical: 13, paddingHorizontal: 17, borderRadius: 13, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondary: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.line },
  buttonText: { color: c.white, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  iconButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: c.white },
  dot: { position: 'absolute', right: 4, top: 3, minWidth: 17, height: 17, borderRadius: 10, backgroundColor: c.red, justifyContent: 'center', alignItems: 'center' },
  badge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 7, alignSelf: 'flex-start' },
  notice: { backgroundColor: c.pale, padding: 14, borderRadius: 13, flexDirection: 'row', gap: 9, marginBottom: 12 },
  input: { backgroundColor: c.white, borderWidth: 1, borderColor: '#d5dfea', borderRadius: 12, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text },
  chip: { borderRadius: 20, paddingHorizontal: 16, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line, backgroundColor: c.white },
  link: { color: c.blue, fontWeight: '700', fontSize: 13 },
  iconWell: { width: 62, height: 62, borderRadius: 20, backgroundColor: c.pale, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: '#07192a88', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%', width: '100%', maxWidth: 680, alignSelf: 'center', flexShrink: 1 },
});
