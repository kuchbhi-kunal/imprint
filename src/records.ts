import type { NdefRecord } from 'react-native-nfc-manager';
import { nfc } from './nfcLib';

export type RecordKind = 'url' | 'phone' | 'sms';

/** Ionicons glyph names. */
export type IconName = 'link' | 'call' | 'chatbubble' | 'mail' | 'location' | 'wifi' | 'person' | 'logo-android';

export const RECORD_KINDS: { kind: RecordKind; label: string; icon: IconName }[] = [
  { kind: 'url', label: 'Link', icon: 'link' },
  { kind: 'phone', label: 'Phone', icon: 'call' },
  { kind: 'sms', label: 'SMS', icon: 'chatbubble' },
];

/** `label` doubles as the input placeholder — the UI has no separate field labels. */
export type Field = {
  key: string;
  label: string;
  multiline?: boolean;
  keyboard?: 'default' | 'url' | 'phone-pad' | 'email-address';
  secure?: boolean;
  optional?: boolean;
};

export const FIELDS: Record<RecordKind, Field[]> = {
  url: [{ key: 'url', label: 'example.com', keyboard: 'url' }],
  phone: [{ key: 'phone', label: 'Phone number', keyboard: 'phone-pad' }],
  sms: [
    { key: 'phone', label: 'Phone number', keyboard: 'phone-pad' },
    { key: 'body', label: 'Message', optional: true, multiline: true },
  ],
};

export type FormValues = Record<string, string>;

/** Required fields that are still empty. */
export function missingFields(kind: RecordKind, values: FormValues): string[] {
  return FIELDS[kind].filter((f) => !f.optional && !(values[f.key] ?? '').trim()).map((f) => f.key);
}

// Google Maps link formats — only used to label Maps cards made elsewhere when reading them.
const MAPS_URL = 'https://maps.google.com/?q=';
const MAPS_URL_OLD = 'https://www.google.com/maps/search/?api=1&query=';

const APP_NAMES: Record<string, string> = {
  'com.android.chrome': 'Chrome',
  'com.google.android.apps.maps': 'Google Maps',
};

const cleanPhone = (p: string) => p.replace(/[^\d+*#]/g, '');

/**
 * Android app that opens instantly when the card is tapped (an Android
 * Application Record placed after the main record). Without it Android shows a
 * notification first. iOS ignores it. Only set for kinds whose app is on nearly
 * every Android phone — if the app is missing, Android opens the Play Store.
 */
export const INSTANT_OPEN_APP: Partial<Record<RecordKind, string>> = {
  url: 'com.android.chrome',
};

/**
 * Brand signature: a plain Text record added after the card's main content. Every NFC app
 * (NFC Tools etc.) lists it, so the card always shows who made it. Phones act on the first
 * record, so it never changes what happens on tap. Branding only — authenticity is checked
 * cryptographically in ntag.ts, not by this text.
 */
export const BRAND_TEXT = '3AM Builds';
export const BRAND_URL = 'https://3ambuilds.com';

/** The two brand records added after the card's content: a link to the website, then the name. */
export function brandRecords(): NdefRecord[] {
  const { Ndef } = nfc();
  return [Ndef.uriRecord(BRAND_URL), Ndef.textRecord(BRAND_TEXT)];
}

export function isBrandRecord(r: NdefRecord): boolean {
  const { Ndef } = nfc();
  try {
    const type = typeof r.type === 'string' ? r.type : Ndef.util.bytesToString(r.type);
    if (r.tnf !== Ndef.TNF_WELL_KNOWN) return false;
    const payload = Uint8Array.from(r.payload ?? []);
    if (type === Ndef.RTD_TEXT) return Ndef.text.decodePayload(payload) === BRAND_TEXT;
    if (type === Ndef.RTD_URI) return Ndef.uri.decodePayload(payload) === BRAND_URL;
    return false;
  } catch {
    return false;
  }
}

/**
 * Records to show in imprint's Read view: hides the brand records (shown as "imprint card · 3AM Builds"
 * instead). A card holding only branding (fresh/erased) shows as empty. A customer link that happens to be
 * the brand URL in first position is kept.
 */
export function visibleRecords(records: NdefRecord[]): NdefRecord[] {
  if (records.every(isBrandRecord)) return [];
  return records.filter((r, i) => i === 0 || !isBrandRecord(r));
}

/**
 * Bytes a message occupies. With `framing`, includes the card's NDEF wrapper (type, length,
 * terminator) — matches imprint's content capacity. Without it, matches the phone-reported max size.
 */
export function messageBytes(records: NdefRecord[], { framing = true } = {}): number {
  // Sized from each record's parts rather than re-encoding: records read from a card have their
  // type as bytes (and Android gives the id as a hex string), which the encoder can't take back.
  const utf8Len = (str: string) => new TextEncoder().encode(str).length;
  let len = 0;
  for (const r of records) {
    const typeLen = typeof r.type === 'string' ? utf8Len(r.type) : (r.type?.length ?? 0);
    const idLen = !r.id ? 0 : typeof r.id === 'string' ? Math.ceil(r.id.length / 2) : r.id.length;
    const payloadLen = r.payload?.length ?? 0;
    len += 1 + 1 + (payloadLen < 0xff ? 1 : 4) + (idLen > 0 ? 1 : 0) + typeLen + idLen + payloadLen;
  }
  return framing ? len + (len < 0xff ? 3 : 5) : len;
}

export function buildRecords(kind: RecordKind, v: FormValues, { instantOpen = false } = {}): NdefRecord[] {
  const { Ndef } = nfc();
  const records = buildMainRecords(kind, v);
  const app = INSTANT_OPEN_APP[kind];
  return [...records, ...(instantOpen && app ? [Ndef.androidApplicationRecord(app)] : []), ...brandRecords()];
}

function buildMainRecords(kind: RecordKind, v: FormValues): NdefRecord[] {
  const { Ndef } = nfc();
  const t = (k: string) => (v[k] ?? '').trim();
  switch (kind) {
    case 'url': {
      const url = /^[a-z][a-z0-9+.-]*:/i.test(t('url')) ? t('url') : `https://${t('url')}`;
      return [Ndef.uriRecord(url)];
    }
    case 'phone':
      return [Ndef.uriRecord(`tel:${cleanPhone(t('phone'))}`)];
    case 'sms':
      return [Ndef.uriRecord(`sms:${cleanPhone(t('phone'))}${t('body') ? `?body=${encodeURIComponent(t('body'))}` : ''}`)];
  }
}

/** Human-readable description of a record read from a tag. */
export function describeRecord(r: NdefRecord): { title: string; value: string; icon: IconName | 'document-text' | 'cube' } {
  const { Ndef } = nfc();
  const type = typeof r.type === 'string' ? r.type : Ndef.util.bytesToString(r.type);
  const payload = Uint8Array.from(r.payload ?? []);
  try {
    if (r.tnf === Ndef.TNF_WELL_KNOWN && type === Ndef.RTD_TEXT) {
      return { title: 'Text', value: Ndef.text.decodePayload(payload), icon: 'document-text' };
    }
    if (r.tnf === Ndef.TNF_WELL_KNOWN && type === Ndef.RTD_URI) {
      const uri = Ndef.uri.decodePayload(payload);
      if (uri.startsWith('tel:')) return { title: 'Phone', value: uri.slice(4), icon: 'call' };
      if (uri.startsWith('sms:')) return { title: 'SMS', value: decodeURIComponent(uri.slice(4).split('?')[0]), icon: 'chatbubble' };
      for (const prefix of [MAPS_URL, MAPS_URL_OLD]) {
        if (uri.startsWith(prefix)) return { title: 'Maps', value: decodeURIComponent(uri.slice(prefix.length)), icon: 'location' };
      }
      if (uri.startsWith('mailto:')) return { title: 'Email', value: decodeURIComponent(uri.slice(7).split('?')[0]), icon: 'mail' };
      return { title: 'Link', value: uri, icon: 'link' };
    }
    if (r.tnf === Ndef.TNF_MIME_MEDIA && type === Ndef.MIME_WFA_WSC) {
      const wifi = Ndef.wifiSimple.decodePayload(payload);
      return { title: 'Wi-Fi', value: wifi.ssid, icon: 'wifi' };
    }
    if (r.tnf === Ndef.TNF_MIME_MEDIA && /vcard/i.test(type)) {
      const card = Ndef.util.bytesToString(r.payload);
      const name = /^FN:(.*)$/m.exec(card)?.[1]?.trim();
      return { title: 'Contact', value: name ?? '', icon: 'person' };
    }
    if (r.tnf === Ndef.TNF_MIME_MEDIA) {
      return { title: type, value: Ndef.util.bytesToString(r.payload), icon: 'cube' };
    }
    if (r.tnf === Ndef.TNF_EXTERNAL_TYPE && type === 'android.com:pkg') {
      const pkg = Ndef.util.bytesToString(r.payload);
      const name = APP_NAMES[pkg] ?? pkg;
      return { title: 'Opens in (Android)', value: name, icon: 'logo-android' };
    }
    if (r.tnf === Ndef.TNF_EMPTY) {
      return { title: 'Empty', value: '', icon: 'cube' };
    }
  } catch {
    // fall through to raw output
  }
  return { title: 'Data', value: Ndef.util.bytesToHexString(r.payload), icon: 'cube' };
}
