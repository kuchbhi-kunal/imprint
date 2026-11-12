import { brandSecret } from './secret';
import { sha256, sha256Bytes } from './sha256';

const hexOf = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('');

/** Salted SHA-256 of the admin password (the password itself is not stored in the app). */
const ADMIN_HASH = '9ff691ff4ad52350c5134938cef7568875184feb9e23b7ffee6bc981de29cab5';

export function checkAdminPassword(input: string): boolean {
  return hexOf(sha256(`imprint-admin/v1:${input}`)) === ADMIN_HASH;
}

/** Short, non-reversible identifier of the brand key, e.g. "A7F3-91C2". */
export function keyFingerprint(): string {
  const h = hexOf(sha256Bytes(brandSecret())).slice(0, 8).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}

/** The full brand key as hex (admin only). */
export function fullKeyHex(): string {
  return hexOf(brandSecret());
}
