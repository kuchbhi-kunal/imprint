# imprint

Expo (React Native) app for iOS and Android that writes, reads and erases NFC cards (NDEF), with optional password protection on NTAG213/215/216.

Can write: links, phone calls and SMS. These are the only types that open on both iPhone and Android without an app.

## Requirements

- Node 22.13+ (`nvm use`, see `.nvmrc`)
- A **real phone with NFC**. Simulators and emulators have no NFC.
- Expo Go and emulators open the app in **preview mode**, where you can see the UI but scanning is simulated. Real NFC needs a development build, because the NFC module is native code.
- iOS: iPhone 7 or newer, Xcode, and an Apple Developer account. The NFC Tag Reading capability requires a paid team.
- Android: Android Studio/SDK, or build in the cloud with EAS.

## Run

```bash
npm install
npx expo run:android --device   # phone connected via USB, USB debugging on
npx expo run:ios --device       # iPhone connected; pick your signing team in Xcode if prompted
```

Or build in the cloud with no local Xcode/Android Studio:

```bash
npx eas-cli@latest build --profile development --platform android   # or ios
```

Before release, change `bundleIdentifier` / `package` in `app.json` (currently `com.example.nfcwriter`).

## Code

- `App.tsx`: UI (Write / Read tabs, Android scan sheet)
- `src/records.ts`: form fields per record type, NDEF record builders, decoding for display
- `src/nfc.ts`: NFC session handling: write (auto-formats blank tags on Android), read, erase
- `src/ntag.ts`: NTAG password protection (raw chip commands, iOS + Android)

## Good cards to buy

NTAG213 (144 bytes), NTAG215 (504 bytes), or NTAG216 (888 bytes). They work on both iOS and Android.
MIFARE Classic cards **do not work on iPhone**.

## imprint cards (brand lock)

Only **activated** NXP NTAG213/215/216 cards can be written. Any card can still be read; others show
"Not an imprint card · read only".

- **Activate cards:** tap the *imprint* title 7 times → *Admin* → **Activate** tab → tap blank cards one by one.
  Activation checks NXP's originality signature, writes an 8-byte brand signature
  (HMAC of the chip UID with the brand secret) and sets a hidden per-card chip password, so only imprint can write it.
- **Customer password:** an app-level password whose hash is stored on the card (in imprint's reserved area).
- **Memory:** the last 3 user pages are reserved (password hash + signature). NTAG213 leaves 132 bytes for content.
- **Brand secret:** `src/secret.ts` (masked). Never change it once cards ship — existing cards are tied to it.
  Keep the backup (IMPRINT-SECRET-KEY-BACKUP.txt) in a password manager.
- Code: `src/ntag.ts` (card logic), `src/nxp.ts` (NXP originality check), `src/sha256.ts` (SHA-256/HMAC).

## Setup after cloning

1. `npm install`
2. Restore the brand key (it is **not** in git):
   `node scripts/make-secret.js <64-hex-key from the private backup>`
   The script prints the key fingerprint — it must be **64B3-C3FF** (shown in the app's admin mode too).
3. Build: `npx expo prebuild --platform android && cd android && ./gradlew assembleRelease`
