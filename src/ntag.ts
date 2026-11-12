/**
 * imprint cards: NXP NTAG213/215/216 chips activated with the brand secret.
 *
 * Activation (hidden admin mode) writes, per card:
 *  - an 8-byte brand signature  = HMAC(secret, "imprint/sig/v1" ‖ UID)  → proves it's one of ours
 *  - a hidden chip password     = HMAC(secret, "imprint/pwd/v1" ‖ UID)  → only imprint can write it
 * and checks NXP's factory originality signature (genuine chip, not a UID-cloning "magic" card).
 *
 * Memory layout (last three user pages are reserved, the rest holds the NDEF message):
 *   userEnd-2  customer password hash (4 bytes, all zero = no password)
 *   userEnd-1  brand signature, bytes 0-3
 *   userEnd    brand signature, bytes 4-7
 * Write protection: AUTH0 = page 4, PROT = 0 → writes need the chip password, reads stay open,
 * so any phone can still tap the card and open its link.
 *
 * The customer "Password" is an app-level check: its hash lives on the card (writable only by
 * imprint) and imprint asks for it before changing the card.
 */
import { Platform } from 'react-native';
import type { NdefRecord } from 'react-native-nfc-manager';
import { NfcCancelled, cancelScan, friendlyError } from './nfc';
import { nfc } from './nfcLib';
import { verifyNxpOriginality } from './nxp';
import { brandRecords } from './records';
import { brandSecret } from './secret';
import { hmacSha256 } from './sha256';

const CMD = { GET_VERSION: 0x60, READ: 0x30, WRITE: 0xa2, PWD_AUTH: 0x1b, READ_SIG: 0x3c };
const USER_START = 4;
const AUTH0_DISABLED = 0xff;

export const NOT_IMPRINT = 'Not an imprint card';

/**
 * Require NXP's factory originality signature (genuine NXP chip)?
 * Off: the current card stock uses NTAG213-compatible chips from another maker, which can't produce
 * NXP's signature. The brand signature + hidden chip password still apply; what's lost is protection
 * against UID-cloning "magic" cards. Turn back on (true) when switching to genuine NXP stock — cards
 * activated meanwhile keep working only if they are genuine NXP chips.
 */
export const REQUIRE_NXP_ORIGINALITY = false;

type Chip = { name: string; userEnd: number; cfg0: number; ccSize: number };

/** Keyed by the storage-size byte of GET_VERSION. */
const CHIPS: Record<number, Chip> = {
  0x0f: { name: 'NTAG213', userEnd: 0x27, cfg0: 0x29, ccSize: 0x12 },
  0x11: { name: 'NTAG215', userEnd: 0x81, cfg0: 0x83, ccSize: 0x3e },
  0x13: { name: 'NTAG216', userEnd: 0xe1, cfg0: 0xe3, ccSize: 0x6d },
};

const pinPage = (c: Chip) => c.userEnd - 2;
const sigPage = (c: Chip) => c.userEnd - 1;
const ndefEnd = (c: Chip) => c.userEnd - 3; // last page available for the NDEF message

/* ---------- keys ---------- */

const ascii = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0));
const derive = (label: string, data: number[]) => hmacSha256(brandSecret(), [...ascii(label), ...data]);

function cardKeys(uid: number[]) {
  const pw = derive('imprint/pwd/v1', uid);
  return { sig: derive('imprint/sig/v1', uid).slice(0, 8), pwd: pw.slice(0, 4), pack: pw.slice(4, 6) };
}

function pinHash(uid: number[], pin: string) {
  const h = derive('imprint/pin/v1', [...uid, ...Array.from(new TextEncoder().encode(pin))]).slice(0, 4);
  if (!h.some((b) => b !== 0)) h[3] = 1; // all-zero means "no password"
  return h;
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/* ---------- low-level ---------- */

function send(bytes: number[]): Promise<number[]> {
  const M = nfc().default;
  return Platform.OS === 'ios' ? M.sendMifareCommandIOS(bytes) : M.nfcAHandler.transceive(bytes);
}

/** A 4-bit NAK comes back as a single byte other than 0x0A. */
const isNak = (res: number[]) => res.length === 1 && (res[0] & 0x0f) !== 0x0a;
/** Only a clear 4-bit ACK (0x0A) counts as "write accepted". */
const isAck = (res: number[]) => res.length === 1 && (res[0] & 0x0f) === 0x0a;

async function read(page: number) {
  const res = await send([CMD.READ, page]);
  if (res.length < 16) throw new Error('Couldn’t read card');
  return res;
}

async function write(page: number, data: number[]) {
  const res = await send([CMD.WRITE, page, ...data]);
  if (isNak(res)) throw new Error('Card refused write');
}

/* ---------- session ---------- */

type Session = {
  chip: Chip;
  uid: number[];
  cfg: number[]; // CFG0, ACCESS, (PWD), (PACK)
  protectedNow: boolean;
  storedPin: number[];
  storedSig: number[];
  nxpGenuine: boolean;
};

async function open(): Promise<Session | null> {
  let version: number[];
  try {
    version = await send([CMD.GET_VERSION]);
  } catch {
    return null;
  }
  const chip = version[1] === 0x04 && version[2] === 0x04 ? CHIPS[version[6]] : undefined;
  if (!chip) return null;
  const head = await read(0);
  const uid = [...head.slice(0, 3), ...head.slice(4, 8)];
  const cfg = await read(chip.cfg0);
  const reserved = await read(pinPage(chip)); // pin page + 2 signature pages (+1 beyond)
  let nxpGenuine = false;
  try {
    nxpGenuine = verifyNxpOriginality(uid, (await send([CMD.READ_SIG, 0x00])).slice(0, 32));
  } catch {
    nxpGenuine = false;
  }
  return {
    chip,
    uid,
    cfg,
    protectedNow: cfg[3] !== AUTH0_DISABLED && cfg[3] <= chip.cfg0 + 3,
    storedPin: reserved.slice(0, 4),
    storedSig: reserved.slice(4, 12),
    nxpGenuine,
  };
}

const isImprint = (s: Session): boolean =>
  (!REQUIRE_NXP_ORIGINALITY || s.nxpGenuine) && same(s.storedSig, cardKeys(s.uid).sig);
const hasPin = (s: Session) => s.storedPin.some((b) => b !== 0);

async function authenticate(uid: number[]) {
  const { pwd, pack } = cardKeys(uid);
  let res: number[];
  try {
    res = await send([CMD.PWD_AUTH, ...pwd]);
  } catch {
    throw new Error(NOT_IMPRINT);
  }
  if (res.length < 2 || isNak(res) || res[0] !== pack[0] || res[1] !== pack[1]) throw new Error(NOT_IMPRINT);
}

/** Runs `fn` with a raw-command NFC session on the tapped card. */
async function withCard<T>(doneMessage: string, fn: (s: Session | null) => Promise<T>): Promise<T> {
  const { default: M, NfcTech } = nfc();
  const tech = Platform.OS === 'ios' ? NfcTech.MifareIOS : NfcTech.NfcA;
  let cancelled = false;
  try {
    await M.requestTechnology(tech, { alertMessage: 'Hold near card' });
    const result = await fn(await open());
    if (Platform.OS === 'ios') await M.setAlertMessageIOS(doneMessage);
    return result;
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message ?? e))) {
      cancelled = true;
      throw new NfcCancelled();
    }
    if (Platform.OS === 'ios') await M.invalidateSessionWithErrorIOS(friendlyError(e)).catch(() => {});
    throw e;
  } finally {
    await cancelScan({ immediate: cancelled });
  }
}

/** Opens an imprint card for changes: checks it's ours, unlocks it, and checks the customer password. */
async function unlockForChange(s: Session | null, password: string): Promise<Session> {
  if (!s || !isImprint(s)) throw new Error(NOT_IMPRINT);
  await authenticate(s.uid);
  if (hasPin(s)) {
    if (!password) throw new Error('Card has a password · turn on Password');
    if (!same(pinHash(s.uid, password), s.storedPin)) throw new Error('Wrong password');
  }
  return s;
}

async function writeNdef(chip: Chip, records: NdefRecord[]) {
  const { Ndef } = nfc();
  const msg = Ndef.encodeMessage(records);
  const tlv = msg.length < 0xff ? [0x03, msg.length, ...msg, 0xfe] : [0x03, 0xff, msg.length >> 8, msg.length & 0xff, ...msg, 0xfe];
  while (tlv.length % 4) tlv.push(0);
  const capacity = (ndefEnd(chip) - USER_START + 1) * 4;
  if (tlv.length > capacity) throw new Error(`Too large · ${tlv.length}/${capacity} bytes`);
  for (let i = 0; i < tlv.length; i += 4) await write(USER_START + i / 4, tlv.slice(i, i + 4));
  return msg.length;
}

export const uidHex = (uid: number[]) => uid.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');

/* ---------- customer operations ---------- */

/** Status of the tapped card during an already-open raw session (used by Read). */
/** Raw facts about the chip, shown in admin mode to debug cards that don't read as imprint. */
export type CardDiagnostics = {
  chip: string;
  uid?: string;
  nxpGenuine?: boolean;
  brandSignature?: 'match' | 'missing' | 'mismatch';
  auth0?: number;
  page3to4?: string;
  error?: string;
};

const hexBytes = (b: number[]) => b.map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');

export async function probeImprintCard(): Promise<{
  imprint: boolean;
  password?: boolean;
  contentCapacity?: number;
  diag: CardDiagnostics;
}> {
  try {
    const s = await open();
    if (!s) return { imprint: false, diag: { chip: 'not NTAG21x (GET_VERSION failed or unknown)' } };
    const expected = cardKeys(s.uid).sig;
    const diag: CardDiagnostics = {
      chip: s.chip.name,
      uid: uidHex(s.uid),
      nxpGenuine: s.nxpGenuine,
      brandSignature: same(s.storedSig, expected) ? 'match' : s.storedSig.every((b) => b === 0) ? 'missing' : 'mismatch',
      auth0: s.cfg[3],
    };
    try {
      diag.page3to4 = hexBytes((await read(3)).slice(0, 8));
    } catch {
      // optional
    }
    return isImprint(s)
      ? { imprint: true, password: hasPin(s), contentCapacity: (ndefEnd(s.chip) - USER_START + 1) * 4, diag }
      : { imprint: false, diag };
  } catch (e) {
    return { imprint: false, diag: { chip: '?', error: String((e as Error)?.message ?? e) } };
  }
}

/**
 * Writes records to an imprint card. `password` is the customer password field:
 * required if the card already has one; if given, it's set on the card.
 */
export function writeImprint(records: NdefRecord[], password: string) {
  return withCard('Written', async (s) => {
    const card = await unlockForChange(s, password);
    const bytes = await writeNdef(card.chip, records);
    if (password && !hasPin(card)) await write(pinPage(card.chip), pinHash(card.uid, password));
    return { bytes };
  });
}

/** Clears an imprint card's contents (keeps its password and the 3AM Builds branding). */
export function eraseImprint(password: string) {
  return withCard('Erased', async (s) => {
    const card = await unlockForChange(s, password);
    await writeNdef(card.chip, brandRecords());
    return { bytes: 0 };
  });
}

/** Removes the customer password from an imprint card. */
export function removeImprintPassword(password: string) {
  return withCard('Password removed', async (s) => {
    if (s && isImprint(s) && !hasPin(s)) throw new Error('Card has no password');
    const card = await unlockForChange(s, password);
    await write(pinPage(card.chip), [0, 0, 0, 0]);
    return { bytes: 0 };
  });
}

/* ---------- internals used by the separate admin app (activation) ---------- */

export type { Chip, Session };
export const internals = {
  CMD,
  USER_START,
  pinPage,
  sigPage,
  cardKeys,
  send,
  read,
  write,
  isAck,
  isImprint,
  authenticate,
  withCard,
  writeNdef,
};
