/**
 * Permanent on-device record of activated imprint cards, with CSV export.
 * Stored only on this phone (AsyncStorage) — export regularly to keep a copy.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ActivationResult, LogEntry } from './types';

export type { LogEntry };

const KEY = 'imprint.activations.v1';

export async function loadLog(): Promise<LogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveLog(list: LogEntry[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

function noteFor(res: ActivationResult) {
  return [
    res.alreadyActive && 'already active',
    !res.nxpGenuine && 'compatible chip',
    res.writeProtected === false && 'NOT write-protected',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Adds a card to the log (newest first). Returns the new list and whether it was already listed. */
export async function recordActivation(res: ActivationResult): Promise<{ list: LogEntry[]; duplicate: boolean }> {
  const list = await loadLog();
  const existing = list.find((e) => e.uid === res.uid);
  if (existing) {
    // Re-check of a listed card: refresh its protection note.
    if (res.writeProtected !== undefined) {
      const note = noteFor({ ...res, alreadyActive: false });
      const next = list.map((e) => (e.uid === res.uid ? { ...e, note: note || undefined } : e));
      await saveLog(next);
      return { list: next, duplicate: true };
    }
    return { list, duplicate: true };
  }
  const entry: LogEntry = {
    uid: res.uid,
    chip: res.chip,
    activatedAt: new Date().toISOString(),
    ...(noteFor(res) ? { note: noteFor(res) } : {}),
  };
  const next = [entry, ...list];
  await saveLog(next);
  return { list: next, duplicate: false };
}

export function countToday(list: LogEntry[]) {
  const today = new Date().toDateString();
  return list.filter((e) => new Date(e.activatedAt).toDateString() === today).length;
}

/** Local date/time without seconds, e.g. "2026-11-11 23:41". */
export function formatWhen(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(list: LogEntry[]) {
  const rows = [['#', 'card_id', 'chip', 'activated_at_local', 'activated_at_utc', 'note']];
  // oldest first in the file, numbered in activation order
  [...list].reverse().forEach((e, i) =>
    rows.push([String(i + 1), e.uid, e.chip, formatWhen(e.activatedAt), e.activatedAt, e.note ?? '']),
  );
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Writes the log to a CSV file and opens the system share sheet. */
export async function exportCsv(list: LogEntry[]) {
  const stamp = formatWhen(new Date().toISOString()).replace(/[: ]/g, '-');
  const file = new File(Paths.cache, `imprint-activations-${stamp}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(toCsv(list));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Export activations' });
}
