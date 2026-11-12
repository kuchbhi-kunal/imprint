#!/usr/bin/env node
// Creates src/secret.ts (git-ignored) from the 64-hex-character brand key in the private backup.
// Usage: node scripts/make-secret.js <64-hex-key>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const hex = (process.argv[2] || '').trim();
if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
  console.error('Usage: node scripts/make-secret.js <64-hex-character key>');
  process.exit(1);
}
const key = Buffer.from(hex, 'hex');
const mask = crypto.randomBytes(32);
const stored = Buffer.from(key.map((b, i) => b ^ mask[i]));
const fmt = (buf) => Array.from(buf, (b) => `0x${b.toString(16).padStart(2, '0')}`).join(', ');
const fingerprint = crypto.createHash('sha256').update(key).digest('hex').slice(0, 8).toUpperCase();

const out = `/**
 * imprint brand secret (32 bytes), stored XOR-masked. Git-ignored — never commit.
 * Fingerprint: ${fingerprint.slice(0, 4)}-${fingerprint.slice(4)}
 */
const A = [${fmt(stored)}];
const B = [${fmt(mask)}];

export function brandSecret(): number[] {
  return A.map((x, i) => x ^ B[i]);
}
`;
const target = path.join(__dirname, '..', 'src', 'secret.ts');
fs.writeFileSync(target, out);
console.log(`Wrote src/secret.ts (key fingerprint ${fingerprint.slice(0, 4)}-${fingerprint.slice(4)})`);
