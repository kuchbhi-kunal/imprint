/**
 * Verifies the NXP "originality signature" that NTAG21x chips carry from the factory.
 *
 * NXP signs each chip's 7-byte UID with ECDSA on curve secp128r1. The UID is used directly as the
 * message (no hash). A genuine chip returns the 32-byte signature (r || s) for READ_SIG (0x3C 0x00);
 * cheap "magic" clones usually can't produce a valid one for a copied UID.
 */

const hex = (h: string) => BigInt('0x' + h);

// secp128r1 domain parameters (SEC 2).
const P = hex('FFFFFFFDFFFFFFFFFFFFFFFFFFFFFFFF');
const A = hex('FFFFFFFDFFFFFFFFFFFFFFFFFFFFFFFC');
const N = hex('FFFFFFFE0000000075A30D1B9038A115');
const G: Point = { x: hex('161FF7528B899B2D0C28607CA52C5B86'), y: hex('CF5AC8395BAFEB13C02DA292DDED7A83') };

// NXP's public key for NTAG21x originality signatures (uncompressed point, 04 || X || Y).
export const NXP_NTAG21X_PUBLIC_KEY = '04494E1A386D3D3CFE3DC10E5DE68A499B1C202DB5B132393E89ED19FE5BE8BC61';

type Point = { x: bigint; y: bigint } | null; // null = point at infinity

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const THREE = BigInt(3);

const mod = (a: bigint, m: bigint) => ((a % m) + m) % m;

function inv(a: bigint, m: bigint): bigint {
  let [r0, r1] = [mod(a, m), m];
  let [s0, s1] = [ONE, ZERO];
  while (r1 !== ZERO) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return mod(s0, m);
}

function add(p: Point, q: Point): Point {
  if (!p) return q;
  if (!q) return p;
  if (p.x === q.x && mod(p.y + q.y, P) === ZERO) return null;
  const l =
    p.x === q.x && p.y === q.y
      ? mod((THREE * p.x * p.x + A) * inv(TWO * p.y, P), P)
      : mod((q.y - p.y) * inv(q.x - p.x, P), P);
  const x = mod(l * l - p.x - q.x, P);
  return { x, y: mod(l * (p.x - x) - p.y, P) };
}

function mul(k: bigint, p: Point): Point {
  let result: Point = null;
  let addend = p;
  while (k > ZERO) {
    if (k & ONE) result = add(result, addend);
    addend = add(addend, addend);
    k >>= ONE;
  }
  return result;
}

const bytesToBig = (b: number[]) => (b.length ? hex(b.map((x) => x.toString(16).padStart(2, '0')).join('')) : ZERO);

function parsePublicKey(h: string): Point {
  if (!h.startsWith('04') || h.length !== 66) throw new Error('bad public key');
  return { x: hex(h.slice(2, 34)), y: hex(h.slice(34, 66)) };
}

/** ECDSA verify on secp128r1 with a pre-computed message integer `e`. Exported for tests. */
export function ecdsaVerify(e: bigint, sig: number[], publicKeyHex: string): boolean {
  if (sig.length !== 32) return false;
  const r = bytesToBig(sig.slice(0, 16));
  const s = bytesToBig(sig.slice(16, 32));
  if (r <= ZERO || r >= N || s <= ZERO || s >= N) return false;
  const w = inv(s, N);
  const X = add(mul(mod(e * w, N), G), mul(mod(r * w, N), parsePublicKey(publicKeyHex)));
  return !!X && mod(X.x, N) === r;
}

/** True if `signature` (32 bytes from READ_SIG) is NXP's valid signature over this 7-byte UID. */
export function verifyNxpOriginality(uid: number[], signature: number[]): boolean {
  try {
    return ecdsaVerify(bytesToBig(uid), signature, NXP_NTAG21X_PUBLIC_KEY);
  } catch {
    return false;
  }
}
