import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NfcAvailability, NfcCancelled, cancelScan, friendlyError, initNfc, openNfcSettings, readTag } from './src/nfc';
import { CardDiagnostics, eraseImprint, removeImprintPassword, writeImprint } from './src/ntag';
import { FIELDS, FormValues, INSTANT_OPEN_APP, RECORD_KINDS, RecordKind, buildRecords, describeRecord, messageBytes, missingFields, visibleRecords } from './src/records';
// Public app: './src/admin' resolves to stubs (index.public.ts). Admin app: the real activation tools.
import {
  AdminGuide,
  IS_ADMIN,
  LogEntry,
  activateCard,
  countToday,
  exportCsv,
  formatWhen,
  fullKeyHex,
  keyFingerprint,
  loadLog,
  recordActivation,
} from './src/admin';
import { AnimatedSplash } from './src/Splash';
import { type, useTheme } from './src/theme';
import {
  Group,
  IconPicker,
  Input,
  Loading,
  MonoSwitch,
  Pill,
  PasswordInput,
  PasswordSheet,
  PlainButton,
  PrimaryButton,
  Row,
  ScanSheet,
  Segmented,
  SheetState,
  Toast,
  ToastMsg,
  haptic,
} from './src/ui';

type Tab = 'write' | 'read' | 'activate';
type IconName = keyof typeof Ionicons.glyphMap;

type CardView = {
  id: string;
  storage?: { used: number; total: number };
  diag?: CardDiagnostics;
  locked?: boolean;
  password?: boolean;
  imprint: boolean;
  items: { title: string; value: string; icon: IconName }[];
};

const SAMPLE_CARD: CardView = {
  id: '04:A2:B3:C4:D5:E6:F7',
  storage: { used: 64, total: 132 },
  locked: false,
  password: true,
  imprint: true,
  items: [{ title: 'Link', value: 'https://example.com', icon: 'link' }],
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [splash, setSplash] = useState(true);
  const hideSplash = useCallback(() => setSplash(false), []);
  return (
    <SafeAreaProvider>
      <Main />
      {splash ? <AnimatedSplash onDone={hideSplash} /> : null}
    </SafeAreaProvider>
  );
}

function Main() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [availability, setAvailability] = useState<NfcAvailability | 'checking' | 'preview'>('checking');
  const [tab, setTab] = useState<Tab>(IS_ADMIN ? 'activate' : 'write');
  const [kind, setKind] = useState<RecordKind>('url');
  const [values, setValues] = useState<FormValues>({});
  const [protect, setProtect] = useState(false);
  const [instantOpen, setInstantOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [askRemove, setAskRemove] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMsg>(null);
  const [card, setCard] = useState<CardView | null>(null);
  const previewCancel = useRef<(() => void) | null>(null);
  // Admin features exist only in the separate "imprint admin" app build.
  const admin = IS_ADMIN;
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showKey, setShowKey] = useState(false);
  useEffect(() => {
    if (IS_ADMIN) loadLog().then(setLog);
  }, []);

  const preview = availability === 'preview';
  const useOwnSheet = Platform.OS === 'android' || preview; // iOS shows a system sheet

  const checkNfc = useCallback(() => {
    initNfc()
      .then(setAvailability)
      .catch(() => setAvailability('unsupported'));
  }, []);
  useEffect(checkNfc, [checkNfc]);

  const showError = (text: string) => setToast({ text, icon: 'alert-circle', tone: 'error', id: Date.now() });

  /** Simulated scan for preview mode: succeeds after a moment unless cancelled. */
  function simulateScan<T>(value: T) {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => resolve(value), 1800);
      previewCancel.current = () => {
        clearTimeout(timer);
        reject(new NfcCancelled());
      };
    });
  }

  async function run<T>(op: () => Promise<T>, previewValue: T): Promise<T | undefined> {
    setBusy(true);
    if (useOwnSheet) setSheet('scanning');
    try {
      const result = preview ? await simulateScan(previewValue) : await op();
      haptic.success();
      if (useOwnSheet) {
        setSheet('success');
        await wait(900);
      }
      return result;
    } catch (e) {
      if (!(e instanceof NfcCancelled)) {
        haptic.error();
        showError(friendlyError(e));
      }
    } finally {
      previewCancel.current = null;
      setSheet(null);
      setBusy(false);
    }
  }

  function onCancel() {
    setSheet(null); // close right away; session cleanup finishes in the background
    if (previewCancel.current) previewCancel.current();
    else cancelScan({ immediate: true });
  }

  async function onActivate() {
    const fakeUid = () =>
      ['04', ...Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase())].join(':');
    const res = await run(activateCard, { uid: fakeUid(), chip: 'NTAG213', alreadyActive: false, nxpGenuine: false, writeProtected: true });
    if (!res) return;
    if (res.writeProtected === false) {
      haptic.error();
      showError(res.alreadyActive ? 'Chip ignores write protection' : 'Activated, but this chip ignores write protection');
    }
    const { list, duplicate } = await recordActivation(res);
    setLog(list);
    if (duplicate && res.writeProtected === true) setToast({ text: 'Protection verified', icon: 'checkmark-circle', id: Date.now() });
    else if (duplicate && res.writeProtected === undefined) setToast({ text: 'Already in your list', icon: 'information-circle', id: Date.now() });
  }

  async function onExport() {
    try {
      await exportCsv(log);
    } catch (e) {
      showError(friendlyError(e));
    }
  }

  async function onWrite() {
    const records = () => buildRecords(kind, values, { instantOpen });
    const written = await run(() => writeImprint(records(), protect ? password : ''), { bytes: 0 });
    if (written) {
      // Success: clear what was typed (keep the type and toggles). On failure/cancel keep it for a retry.
      setValues({});
      setPassword('');
    }
  }

  function onErase() {
    Alert.alert('Erase card?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase', style: 'destructive', onPress: () => run(() => eraseImprint(protect ? password : ''), { bytes: 0 }) },
    ]);
  }

  function onRemovePassword(pw: string) {
    setAskRemove(false);
    run(() => removeImprintPassword(pw), { bytes: 0 });
  }

  async function onRead() {
    const result = await run(async (): Promise<CardView> => {
      const { tag, capacity, writable, password, imprint, diag } = await readTag();
      return {
        id: tag.id ?? '—',
        storage: capacity
          ? { used: Math.min(messageBytes(tag.ndefMessage ?? [], { framing: imprint }), capacity), total: capacity }
          : undefined,
        locked: writable === undefined ? undefined : !writable,
        password,
        imprint,
        diag,
        items: visibleRecords(tag.ndefMessage ?? []).map(describeRecord),
      };
    }, SAMPLE_CARD);
    if (result) setCard(result);
  }

  /* ---------- NFC unavailable ---------- */

  if (availability === 'checking') {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: t.bg }]}>
        <Loading />
      </View>
    );
  }

  if (availability === 'unsupported' || availability === 'disabled') {
    const off = availability === 'disabled';
    return (
      <View style={[styles.fill, { backgroundColor: t.bg, paddingBottom: insets.bottom + 16 }]}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <View style={[styles.fill, styles.center, { gap: 16 }]}>
          <MaterialCommunityIcons name="nfc-variant-off" size={56} color={t.text} />
          <Text style={[type.title, { color: t.text }]}>{off ? 'NFC Is Off' : 'No NFC'}</Text>
        </View>
        <View style={styles.footer}>
          {off ? (
            <PrimaryButton title="Open Settings" onPress={openNfcSettings} />
          ) : (
            <PrimaryButton title="Preview" onPress={() => setAvailability('preview')} />
          )}
          {off ? <PlainButton title="Retry" onPress={checkNfc} /> : null}
        </View>
      </View>
    );
  }

  /* ---------- Main ---------- */

  const missing = missingFields(kind, values);

  return (
    <View style={[styles.fill, { backgroundColor: t.bg }]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.titleRow}>
            <Text style={[type.largeTitle, { color: t.text }]}>imprint</Text>
            {preview && <Pill text="Preview" theme={t} />}
            {admin && <Pill text="Admin" theme={t} />}
          </View>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              ...(admin ? [{ value: 'activate' as Tab, label: 'Activate' }] : []),
              { value: 'write', label: 'Write' },
              { value: 'read', label: 'Read' },
            ]}
          />
        </View>

        <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {tab === 'write' ? (
            <>
              <IconPicker
                options={RECORD_KINDS}
                value={kind}
                onChange={(k) => {
                  setKind(k);
                  setValues({});
                }}
              />

              <Group>
                {FIELDS[kind].map((f) => (
                  <Input
                    key={`${kind}-${f.key}`}
                    value={values[f.key] ?? ''}
                    onChangeText={(text) => setValues((v) => ({ ...v, [f.key]: text }))}
                    placeholder={f.label}
                    multiline={f.multiline}
                    keyboardType={f.keyboard ?? 'default'}
                    secureTextEntry={f.secure}
                    autoCapitalize={f.keyboard || f.secure ? 'none' : 'words'}
                    autoCorrect={false}
                  />
                ))}
              </Group>

              {INSTANT_OPEN_APP[kind] ? (
                <View style={styles.listSection}>
                  <Group>
                    <Row
                      icon="flash-outline"
                      title="Instant Open"
                      right={<MonoSwitch value={instantOpen} onValueChange={setInstantOpen} />}
                    />
                  </Group>
                  <Text style={[type.footnote, styles.groupNote, { color: t.secondary }]}>
                    Opens the link in Chrome straight away, without a prompt to open the URL. Android only. Recommended for links that need to open in Chrome.
                  </Text>
                </View>
              ) : null}

              <Group>
                <Row
                  icon="key-outline"
                  title="Password"
                  subtitle="Only required to change or erase this card"
                  right={
                    <MonoSwitch value={protect} onValueChange={setProtect} />
                  }
                />
                {protect ? (
                  <PasswordInput value={password} onChangeText={setPassword} placeholder="Password" />
                ) : null}
              </Group>
            </>
          ) : tab === 'read' && card ? (
            <>
              <Group>
                {card.items.length === 0 ? (
                  <Row icon="remove-circle-outline" title="Empty" />
                ) : (
                  card.items.map((item, i) => (
                    <View key={i} style={styles.record}>
                      <View style={[styles.recordIcon, { backgroundColor: t.text }]}>
                        <Ionicons name={item.icon} size={18} color={t.inverse} />
                      </View>
                      <View style={styles.fill}>
                        <Text style={[type.footnote, { color: t.secondary }]}>{item.title}</Text>
                        {item.value ? (
                          <Text selectable style={[type.body, { color: t.text }]}>
                            {item.value}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </Group>
              <Group>
                <Row title="ID" value={card.id} />
                {card.storage ? (
                  <View style={styles.storage}>
                    <View style={styles.storageTop}>
                      <Text style={[type.body, { color: t.text }]}>Storage</Text>
                      <Text style={[type.body, { color: t.secondary }]}>
                        {card.storage.used} / {card.storage.total} bytes
                      </Text>
                    </View>
                    <View style={[styles.bar, { backgroundColor: t.thumb }]}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min(100, (card.storage.used / card.storage.total) * 100)}%`,
                            backgroundColor: card.storage.used / card.storage.total > 0.9 ? t.danger : t.text,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[type.footnote, { color: t.secondary }]}>
                      {card.storage.total - card.storage.used} bytes free
                    </Text>
                  </View>
                ) : null}
                {card.password !== undefined ? <Row title="Password" value={card.password ? 'Yes' : 'No'} /> : null}
                {card.locked !== undefined ? <Row title="Locked" value={card.locked ? 'Yes' : 'No'} valueColor={card.locked ? t.danger : undefined} /> : null}
              </Group>
              <View style={styles.note}>
                <Ionicons
                  name={card.imprint ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={16}
                  color={card.imprint ? t.success : t.danger}
                />
                <Text style={[type.footnote, { color: t.secondary }]}>
                  {card.imprint ? 'imprint card · 3AM Builds' : 'Not an imprint card · read only'}
                </Text>
              </View>
              {admin && card.diag ? (
                <View style={styles.listSection}>
                  <Text style={[type.footnote, styles.listHeading, { color: t.secondary }]}>Diagnostics</Text>
                  <Group>
                    <Row title="Chip" value={card.diag.chip} />
                    {card.diag.uid ? <Row title="UID" value={card.diag.uid} /> : null}
                    {card.diag.nxpGenuine !== undefined ? <Row title="NXP genuine" value={card.diag.nxpGenuine ? 'Yes' : 'No'} /> : null}
                    {card.diag.brandSignature ? <Row title="Brand signature" value={card.diag.brandSignature} /> : null}
                    {card.diag.auth0 !== undefined ? (
                      <Row title="Protection (AUTH0)" value={`0x${card.diag.auth0.toString(16).toUpperCase()}${card.diag.auth0 === 4 ? ' · on' : card.diag.auth0 === 0xff ? ' · off' : ''}`} />
                    ) : null}
                    {card.diag.page3to4 ? <Row title="Pages 3–4" value={card.diag.page3to4} /> : null}
                    {card.diag.error ? <Row title="Error" value={card.diag.error} valueColor={t.danger} /> : null}
                  </Group>
                </View>
              ) : null}
            </>
          ) : tab === 'activate' ? (
            <>
              <View style={styles.activateHero}>
                <View style={[styles.heroCircle, { backgroundColor: t.surface }]}>
                  <Ionicons name="shield-checkmark-outline" size={60} color={t.text} />
                </View>
                <Text style={[type.title, { color: t.text }]}>{log.length} activated</Text>
                <Text style={[type.footnote, { color: t.secondary, textAlign: 'center' }]}>
                  {countToday(log)} today · saved on this phone
                </Text>
              </View>
              {log.length > 0 ? (
                <View style={styles.listSection}>
                  <Text style={[type.footnote, styles.listHeading, { color: t.secondary }]}>All activated cards</Text>
                  <Group>
                    {log.map((e, i) => (
                      <Row
                        key={e.uid}
                        icon={
                          e.note?.includes('NOT write-protected')
                            ? 'warning-outline'
                            : e.note?.includes('already active')
                              ? 'refresh-outline'
                              : 'checkmark-circle-outline'
                        }
                        title={`${log.length - i}.  ${e.uid}`}
                        subtitle={`${e.chip} · ${formatWhen(e.activatedAt)}${e.note ? ` · ${e.note}` : ''}`}
                      />
                    ))}
                  </Group>
                </View>
              ) : null}
              <AdminGuide />
              <View style={styles.listSection}>
                <Text style={[type.footnote, styles.listHeading, { color: t.secondary }]}>Key fingerprint</Text>
                <Group>
                  <Pressable onLongPress={() => setShowKey((v) => !v)} delayLongPress={600}>
                    <Row icon="key-outline" title="Key" value={keyFingerprint()} />
                  </Pressable>
                  {showKey ? (
                    <Text selectable style={[type.footnote, styles.keyText, { color: t.secondary }]}>
                      {fullKeyHex()}
                    </Text>
                  ) : null}
                </Group>
              </View>
            </>
          ) : (
            <Pressable onPress={onRead} disabled={busy} style={styles.hero}>
              {({ pressed }) => (
                <View style={[styles.heroCircle, { backgroundColor: t.surface, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                  <MaterialCommunityIcons name="nfc-variant" size={64} color={t.text} />
                </View>
              )}
            </Pressable>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          {tab === 'activate' ? (
            <>
              <PrimaryButton title="Activate Card" onPress={onActivate} disabled={busy} />
              <PlainButton title={`Export List (${log.length})`} onPress={onExport} disabled={busy || log.length === 0} />
            </>
          ) : tab === 'write' ? (
            <>
              <PrimaryButton
                title="Write"
                onPress={onWrite}
                disabled={busy || missing.length > 0 || (protect && !password)}
              />
              <View style={styles.plainRow}>
                <PlainButton title="Erase Card" onPress={onErase} disabled={busy || (protect && !password)} />
                <PlainButton title="Remove Password" onPress={() => setAskRemove(true)} disabled={busy} />
              </View>
            </>
          ) : (
            <PrimaryButton
              title={card ? 'Scan Again' : 'Scan'}
              onPress={onRead}
              disabled={busy}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      <PasswordSheet
        visible={askRemove}
        title="Remove Password"
        action="Remove"
        initial={password}
        onSubmit={onRemovePassword}
        onCancel={() => setAskRemove(false)}
      />
      <ScanSheet state={sheet} onCancel={onCancel} />
      <Toast msg={toast} onDone={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, gap: 14, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  content: { padding: 20, gap: 24, flexGrow: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  plainRow: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 320 },
  heroCircle: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center' },
  record: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  recordIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: -12 },
  activateHero: { alignItems: 'center', gap: 12, paddingTop: 24 },
  listSection: { gap: 8 },
  storage: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  storageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  groupNote: { paddingHorizontal: 16 },
  listHeading: { textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16 },
  keyText: { paddingHorizontal: 16, paddingBottom: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
