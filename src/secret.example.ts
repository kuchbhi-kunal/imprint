/**
 * TEMPLATE — copy to `src/secret.ts` (git-ignored) and fill in the real brand key.
 *
 * The real key lives in the private backup (IMPRINT-SECRET-KEY-BACKUP.txt / password manager),
 * never in git. Its fingerprint is shown in admin mode; the current production key is 64B3-C3FF.
 * Every activated card is tied to this key — using a different key means existing cards won't be
 * recognised.
 *
 * The key is stored XOR-masked: A = key XOR B, B = any random 32 bytes.
 * Quick way to generate `src/secret.ts` from the 64-hex-character key:
 *   node scripts/make-secret.js <64-hex-key>
 */
const A: number[] = []; // 32 bytes
const B: number[] = []; // 32 bytes

export function brandSecret(): number[] {
  if (A.length !== 32 || B.length !== 32) throw new Error('src/secret.ts is missing — see src/secret.example.ts');
  return A.map((x, i) => x ^ B[i]);
}
