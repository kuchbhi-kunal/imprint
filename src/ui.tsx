import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Children, ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useAnimatedValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, type, useTheme } from './theme';

export const haptic = {
  select: () => Haptics.selectionAsync().catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const index = options.findIndex((o) => o.value === value);
  const x = useAnimatedValue(index);

  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
  }, [index, x]);

  const segW = width ? (width - 4) / options.length : 0;
  return (
    <View style={[s.segment, { backgroundColor: t.surface }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segW > 0 && (
        <Animated.View
          style={[
            s.segmentThumb,
            { width: segW, backgroundColor: t.thumb, transform: [{ translateX: Animated.multiply(x, segW) }] },
          ]}
        />
      )}
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={s.segmentItem}
          onPress={() => {
            if (o.value !== value) {
              haptic.select();
              onChange(o.value);
            }
          }}
        >
          <Text style={[type.subhead, { fontSize: 16, fontWeight: '600', color: o.value === value ? t.text : t.secondary }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- Grouped list ---------- */

export function Group({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[s.group, { backgroundColor: t.surface }, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 && <View style={[s.separator, { backgroundColor: t.separator }]} />}
          {child}
        </View>
      ))}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.secondary}
      selectionColor={t.text}
      {...props}
      style={[type.body, s.input, { color: t.text }, props.multiline && s.inputMultiline, props.style]}
    />
  );
}

export function Row({
  icon,
  title,
  subtitle,
  subtitleIcon,
  value,
  valueColor,
  right,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  subtitleIcon?: keyof typeof Ionicons.glyphMap;
  value?: string;
  valueColor?: string;
  right?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={s.row}>
      {icon && <Ionicons name={icon} size={20} color={t.text} style={{ width: 28 }} />}
      <View style={{ flex: value ? 0 : 1, gap: 2 }}>
        <Text style={[type.body, { color: t.text }]}>{title}</Text>
        {subtitle ? (
          <View style={s.subtitle}>
            {subtitleIcon ? <Ionicons name={subtitleIcon} size={14} color={t.text} /> : null}
            <Text style={[type.footnote, { color: t.secondary, flexShrink: 1 }]}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
      {value !== undefined && (
        <Text selectable numberOfLines={3} style={[type.body, s.rowValue, { color: valueColor ?? t.secondary }]}>
          {value}
        </Text>
      )}
      {right}
    </View>
  );
}

/** Monochrome iOS-style switch with a selection haptic. */
export function MonoSwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={(v) => {
        haptic.select();
        onValueChange(v);
      }}
      trackColor={{ true: t.text, false: t.tertiary }}
      thumbColor={Platform.OS === 'android' ? (t.dark && value ? '#000' : '#FFF') : undefined}
      ios_backgroundColor={t.tertiary}
    />
  );
}

/** Secure input with a show/hide eye toggle. */
export function PasswordInput(props: Omit<TextInputProps, 'secureTextEntry'>) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.passwordRow}>
      <Input {...props} style={{ flex: 1 }} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} />
      <Pressable
        onPress={() => {
          haptic.select();
          setVisible((v) => !v);
        }}
        hitSlop={10}
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        style={s.eye}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.secondary} />
      </Pressable>
    </View>
  );
}

/* ---------- Buttons ---------- */

export function PrimaryButton({
  title,
  icon,
  onPress,
  disabled,
}: {
  title: string;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.primary,
        { backgroundColor: t.text, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {icon}
      <Text style={[type.headline, { color: t.inverse }]}>{title}</Text>
    </Pressable>
  );
}

export function PlainButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={({ pressed }) => [s.plain, { opacity: pressed || disabled ? 0.4 : 1 }]}>
      <Text style={[type.subhead, { color: t.secondary, fontWeight: '500' }]}>{title}</Text>
    </Pressable>
  );
}

/* ---------- Type picker (circular icon buttons) ---------- */

export function IconPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { kind: T; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={s.picker}>
      {options.map((o) => {
        const active = o.kind === value;
        return (
          <Pressable
            key={o.kind}
            style={s.pickerItem}
            onPress={() => {
              if (!active) {
                haptic.select();
                onChange(o.kind);
              }
            }}
          >
            {({ pressed }) => (
              <>
                <View
                  style={[
                    s.pickerCircle,
                    { backgroundColor: active ? t.text : t.surface, transform: [{ scale: pressed ? 0.94 : 1 }] },
                  ]}
                >
                  <Ionicons name={active ? o.icon : (`${o.icon}-outline` as typeof o.icon)} size={22} color={active ? t.inverse : t.text} />
                </View>
                <Text style={[type.caption, { color: active ? t.text : t.secondary }]}>{o.label}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Scan sheet (Android + preview; iOS uses the system sheet) ---------- */

export type SheetState = 'scanning' | 'success' | null;

export function ScanSheet({ state, onCancel }: { state: SheetState; onCancel: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useAnimatedValue(0);

  useEffect(() => {
    if (state !== 'scanning') return;
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  return (
    <Modal visible={state !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={[s.scrim, { backgroundColor: t.scrim }]}>
        <View style={[s.sheet, { backgroundColor: t.sheet, paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <Text style={[type.title, { color: t.text }]}>{state === 'success' ? 'Done' : 'Ready to Scan'}</Text>

          <View style={s.sheetIconWrap}>
            {state === 'scanning' && (
              <Animated.View
                style={[
                  s.pulse,
                  {
                    borderColor: t.text,
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                  },
                ]}
              />
            )}
            <View
              style={[
                s.sheetIcon,
                state === 'success' ? { borderColor: t.success, backgroundColor: t.successSoft } : { borderColor: t.text },
              ]}
            >
              {state === 'success' ? (
                <Ionicons name="checkmark" size={44} color={t.success} />
              ) : (
                <MaterialCommunityIcons name="nfc-variant" size={44} color={t.text} />
              )}
            </View>
          </View>

          <Text style={[type.subhead, { color: t.secondary }]}>{state === 'success' ? ' ' : 'Hold near card'}</Text>

          <Pressable
            onPress={onCancel}
            disabled={state === 'success'}
            style={({ pressed }) => [s.sheetCancel, { backgroundColor: t.surface, opacity: state === 'success' ? 0 : pressed ? 0.6 : 1 }]}
          >
            <Text style={[type.headline, { color: t.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Password prompt (cross-platform; Alert.prompt is iOS-only) ---------- */

export function PasswordSheet({
  visible,
  title,
  action,
  initial = '',
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  action: string;
  initial?: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initial);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel} onShow={() => setValue(initial)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.scrim, { backgroundColor: t.scrim }]}>
        <View style={[s.sheet, s.promptSheet, { backgroundColor: t.sheet, paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <Ionicons name="key-outline" size={28} color={t.text} />
          <Text style={[type.title, { color: t.text }]}>{title}</Text>
          <View style={[s.group, { backgroundColor: t.surface, alignSelf: 'stretch' }]}>
            <PasswordInput value={value} onChangeText={setValue} placeholder="Password" autoFocus />
          </View>
          <View style={{ alignSelf: 'stretch', gap: 4 }}>
            <PrimaryButton title={action} onPress={() => onSubmit(value)} disabled={!value} />
            <PlainButton title="Cancel" onPress={onCancel} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Admin gate: a bare input, nothing written ---------- */

export function BlankPrompt({ visible, onSubmit, onCancel }: { visible: boolean; onSubmit: (v: string) => void; onCancel: () => void }) {
  const t = useTheme();
  const [value, setValue] = useState('');
  // Fixed position in the upper third (above any keyboard) — no keyboard-avoiding resize, so it never jitters.
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel} onShow={() => setValue('')}>
      <View style={[s.blankScrim, { backgroundColor: t.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[s.group, s.blankBox, { backgroundColor: t.sheet }]}>
          <PasswordInput
            value={value}
            onChangeText={setValue}
            onSubmitEditing={() => onSubmit(value)}
            autoFocus
            returnKeyType="done"
          />
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Toast ---------- */

export type ToastMsg = { text: string; icon: keyof typeof Ionicons.glyphMap; tone?: 'error'; id: number } | null;

/** Shows `msg` briefly, then calls `onDone` so the parent can clear it. */
export function Toast({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useAnimatedValue(0);
  const shown = msg;

  useEffect(() => {
    if (!msg) return;
    anim.setValue(0);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }),
      Animated.delay(2200),
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when a new message arrives
  }, [msg, anim]);

  if (!shown) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.toast,
        {
          top: insets.top + 8,
          backgroundColor: shown.tone === 'error' ? t.sheet : t.text,
          borderWidth: shown.tone === 'error' ? 1 : 0,
          borderColor: t.dangerLine,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}
    >
      <Ionicons name={shown.icon} size={18} color={shown.tone === 'error' ? t.danger : t.inverse} />
      <Text style={[type.subhead, { color: shown.tone === 'error' ? t.text : t.inverse, fontWeight: '600', flexShrink: 1 }]}>
        {shown.text}
      </Text>
    </Animated.View>
  );
}

export function Loading() {
  const t = useTheme();
  return <ActivityIndicator color={t.text} />;
}

export function Pill({ text, theme }: { text: string; theme: Theme }) {
  return (
    <View style={[s.pill, { borderColor: theme.tertiary }]}>
      <Text style={[type.caption, { color: theme.secondary, textTransform: 'uppercase', letterSpacing: 0.8 }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2, height: 42 },
  segmentThumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: 14, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  input: { paddingHorizontal: 16, paddingVertical: 14, minHeight: 50 },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top', paddingTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 50, paddingVertical: 10, gap: 8 },
  rowValue: { flex: 1, textAlign: 'right' },
  subtitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { paddingRight: 16, paddingLeft: 8 },
  primary: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  plain: { alignItems: 'center', paddingVertical: 10 },
  picker: { flexDirection: 'row', justifyContent: 'space-between' },
  pickerItem: { alignItems: 'center', gap: 8, flex: 1 },
  pickerCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, justifyContent: 'flex-end', padding: 8 },
  sheet: { borderRadius: 36, alignItems: 'center', paddingTop: 28, paddingHorizontal: 20, gap: 16 },
  promptSheet: { paddingTop: 24, gap: 14 },
  blankScrim: { flex: 1, justifyContent: 'flex-start', paddingTop: '32%', paddingHorizontal: 40 },
  blankBox: { alignSelf: 'stretch' },
  sheetIconWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  sheetIcon: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2 },
  sheetCancel: { alignSelf: 'stretch', height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
});
