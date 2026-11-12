import { brandSecret } from '../secret';
import { sha256Bytes } from '../sha256';

const hexOf = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('');

/** Short, non-reversible identifier of the brand key, e.g. "A7F3-91C2". */
export function keyFingerprint(): string {
  const h = hexOf(sha256Bytes(brandSecret())).slice(0, 8).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}

/** The full brand key as hex (admin only). */
export function fullKeyHex(): string {
  return hexOf(brandSecret());
}
