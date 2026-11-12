// The NFC library throws at import time when its native module is missing
// (Expo Go, web). Load it lazily so the app can still open in preview mode.
type NfcLib = typeof import('react-native-nfc-manager');

let lib: NfcLib | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lib = require('react-native-nfc-manager');
} catch {
  lib = null;
}

export const nfcLibAvailable = lib !== null;

/** Returns the NFC library; only call this after confirming `nfcLibAvailable`. */
export function nfc(): NfcLib {
  if (!lib) throw new Error('NFC is not available in this build. Use a development build on a real phone.');
  return lib;
}
