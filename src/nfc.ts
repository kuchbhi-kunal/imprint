import { Platform } from 'react-native';
import type { NfcTech, TagEvent } from 'react-native-nfc-manager';
import { nfc, nfcLibAvailable } from './nfcLib';
import { CardDiagnostics, probeImprintCard } from './ntag';

const M = () => nfc().default;

export type NfcAvailability = 'ready' | 'unsupported' | 'disabled';

export async function initNfc(): Promise<NfcAvailability> {
  if (!nfcLibAvailable) return 'unsupported';
  const NfcManager = M();
  const supported = await NfcManager.isSupported();
  if (!supported) return 'unsupported';
  await NfcManager.start();
  // iOS has no user-facing NFC toggle, so isEnabled is only meaningful on Android.
  if (Platform.OS === 'android' && !(await NfcManager.isEnabled())) return 'disabled';
  return 'ready';
}

/**
 * Ends the NFC session. After a real tag exchange Android needs a short pause
 * (default 1s) so the tag isn't handed to another app; when the user cancels
 * there's no tag, so pass `immediate` to skip it.
 */
export function cancelScan({ immediate = false } = {}) {
  if (!nfcLibAvailable) return Promise.resolve();
  return M()
    .cancelTechnologyRequest(immediate ? { delayMsAndroid: 0 } : undefined)
    .catch(() => {});
}

function isUserCancel(e: unknown) {
  const msg = String((e as Error)?.message ?? e ?? '');
  return /cancel/i.test(msg) || e?.constructor?.name === 'UserCancel';
}

export class NfcCancelled extends Error {}

/** Wraps an NFC session: acquires a tag, runs `fn`, always releases the session. */
async function withTag<T>(alertMessage: string, techs: NfcTech[], fn: (tech: NfcTech | null) => Promise<T>): Promise<T> {
  const NfcManager = M();
  let cancelled = false;
  try {
    const tech = await NfcManager.requestTechnology(techs, { alertMessage });
    return await fn(tech);
  } catch (e) {
    if (isUserCancel(e)) {
      cancelled = true;
      throw new NfcCancelled();
    }
    if (Platform.OS === 'ios') {
      await NfcManager.invalidateSessionWithErrorIOS(friendlyError(e)).catch(() => {});
    }
    throw e;
  } finally {
    await cancelScan({ immediate: cancelled });
  }
}

export function friendlyError(e: unknown): string {
  if (e instanceof Error && e.message && !/^\s*$/.test(e.message)) return e.message;
  return 'Couldn’t reach card. Try again.';
}

export type ReadResult = {
  tag: TagEvent;
  capacity?: number;
  writable?: boolean;
  password?: boolean;
  imprint: boolean;
  diag?: CardDiagnostics;
};

export async function readTag(): Promise<ReadResult> {
  const { default: NfcManager, NdefStatus, NfcTech } = nfc();
  // Connect at chip level (not plain NDEF) so we can also ask NTAGs whether a
  // password is set. NDEF contents still come through on both platforms.
  const techs =
    Platform.OS === 'ios' ? [NfcTech.MifareIOS, NfcTech.Iso15693IOS] : [NfcTech.NfcA, NfcTech.Ndef];
  return withTag('Hold near card', techs, async (tech) => {
    const tag = (await NfcManager.getTag()) ?? {};
    let capacity: number | undefined;
    let writable: boolean | undefined;
    if (Platform.OS === 'android') {
      // Android reports these from discovery time, whatever tech is connected.
      capacity = tag.maxSize;
      writable = tag.isWritable;
    } else {
      try {
        const s = await NfcManager.ndefHandler.getNdefStatus();
        capacity = s.capacity;
        writable = s.status === NdefStatus.ReadWrite;
      } catch {
        // not all tags report status
      }
    }
    const raw = tech === NfcTech.NfcA || tech === NfcTech.MifareIOS;
    const probe: Awaited<ReturnType<typeof probeImprintCard>> = raw
      ? await probeImprintCard()
      : { imprint: false, diag: { chip: `not NFC-A (${String(tech)})` } };
    const { imprint, password } = probe;
    // imprint cards: report the space actually available for content (excludes the reserved area).
    if (probe.contentCapacity) capacity = probe.contentCapacity;
    if (Platform.OS === 'ios') await NfcManager.setAlertMessageIOS('Done');
    return { tag, capacity, writable, password, imprint, diag: probe.diag };
  });
}

export function openNfcSettings() {
  if (Platform.OS === 'android' && nfcLibAvailable) M().goToNfcSetting();
}
