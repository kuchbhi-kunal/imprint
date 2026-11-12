/**
 * Card activation — only bundled in the imprint admin app (see metro.config.js / app.config.js).
 * Turns a blank NTAG21x into an imprint card: brand signature, hidden chip password, protection test.
 */
import { Platform } from 'react-native';
import { nfc } from '../nfcLib';
import { REQUIRE_NXP_ORIGINALITY, internals, uidHex } from '../ntag';
import { brandRecords } from '../records';
import type { ActivationResult } from './types';

const { CMD, USER_START, pinPage, sigPage, cardKeys, send, read, write, isAck, isImprint, authenticate, withCard, writeNdef } =
  internals;


/**
 * Checks that the chip refuses a write without the password. Must run in a session that never sent
 * the password. Rewrites page 4 with its current bytes, so nothing changes even if the chip allows it.
 */
async function testProtection(): Promise<boolean> {
  const first = (await read(USER_START)).slice(0, 4);
  try {
    return !isAck(await send([CMD.WRITE, USER_START, ...first]));
  } catch {
    return true; // chip rejected the command → protected
  }
}

/**
 * NTAG chips may only apply new password settings after the card is re-selected, so reconnect
 * (Android) before testing. iOS can't re-select without a new tap → returns undefined (untested).
 */
async function reconnectAndTestProtection(): Promise<boolean | undefined> {
  if (Platform.OS !== 'android') return undefined;
  const { default: M, NfcTech } = nfc();
  try {
    await M.close();
    await M.connect([NfcTech.NfcA]);
  } catch {
    return undefined; // card moved away; can be re-checked by activating it again
  }
  return testProtection();
}



/** Turns a blank genuine NTAG21x into an imprint card. Safe to repeat on an already-activated card. */
export function activateCard(): Promise<ActivationResult> {
  return withCard('Activated', async (s) => {
    if (!s) throw new Error('Needs an NTAG213/215/216 card');
    if (REQUIRE_NXP_ORIGINALITY && !s.nxpGenuine) throw new Error('Not a genuine NXP chip');
    const { chip, uid, cfg } = s;
    const keys = cardKeys(uid);
    // Already activated: this is a fresh, unauthenticated session, so re-check protection directly.
    if (isImprint(s)) return { uid: uidHex(uid), chip: chip.name, alreadyActive: true, nxpGenuine: s.nxpGenuine, writeProtected: await testProtection() };

    if (s.protectedNow) {
      try {
        await authenticate(uid);
      } catch {
        throw new Error('Card has a password from another app');
      }
    }
    const access = cfg.slice(4, 8);
    if (access[0] & 0x40) throw new Error('Card settings are locked');

    // Capability Container (page 3): NDEF, writable.
    const cc = (await read(3)).slice(0, 4);
    if (cc[0] !== 0xe1) await write(3, [0xe1, 0x10, chip.ccSize, 0x00]);
    else if (cc[3] !== 0x00) throw new Error('Card is locked');

    await writeNdef(chip, brandRecords()); // fresh card carries only the 3AM Builds branding
    await write(pinPage(chip), [0, 0, 0, 0]); // no customer password
    await write(sigPage(chip), keys.sig.slice(0, 4));
    await write(sigPage(chip) + 1, keys.sig.slice(4, 8));
    // Hidden chip password, then protection (AUTH0 last — protection starts there).
    await write(chip.cfg0 + 2, keys.pwd);
    await write(chip.cfg0 + 3, [...keys.pack, 0x00, 0x00]);
    await write(chip.cfg0 + 1, [access[0] & ~0x80, ...access.slice(1)]); // PROT=0: writes only
    await write(chip.cfg0, [...cfg.slice(0, 3), USER_START]);

    const writeProtected = await reconnectAndTestProtection();
    return { uid: uidHex(uid), chip: chip.name, alreadyActive: false, nxpGenuine: s.nxpGenuine, writeProtected };
  });
}
