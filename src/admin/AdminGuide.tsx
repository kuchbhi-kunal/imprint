import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { type, useTheme } from '../theme';
import { Group } from '../ui';

type Item = { icon?: keyof typeof Ionicons.glyphMap; title: string; body: string };

const STEPS: Item[] = [
  { title: 'Use blank NTAG213 cards', body: 'NTAG213/215/216 or compatible chips. New and blank, with no password set by another app.' },
  { title: 'Tap Activate Card', body: 'Hold one card flat against the back of the phone until the green check appears. A red warning means the chip ignored write protection: set that card aside.' },
  { title: 'Repeat for every card', body: '"Already" means the card was activated before. That\'s fine, nothing changes.' },
  { title: 'Test one card', body: 'Switch to Read and scan it. It should say "imprint card" with a green check.' },
  { title: 'Ship', body: 'Customers write to it with imprint. No other app can change it, but any phone can tap it.' },
];

const HOW: Item[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Protection self-test',
    body: 'After activating, imprint tries a write without the password. If the chip allows it, the card isn\'t really protected and you\'ll see a warning. Compatible (non-NXP) chips are accepted and marked in the list.',
  },
  {
    icon: 'finger-print-outline',
    title: 'Brand signature',
    body: "An 8-byte code made from the card's unique ID and your secret key is written to the card. Copying a card's data onto another chip doesn't work, because the ID won't match.",
  },
  {
    icon: 'lock-closed-outline',
    title: 'Hidden card password',
    body: 'Each card gets its own chip password, also made from your key. Only imprint can work it out, so other apps like NFC Tools can read the card but never change it.',
  },
  {
    icon: 'key-outline',
    title: 'Customer password',
    body: 'Optional. Stored on the card in scrambled form. imprint asks for it before changing or erasing the card.',
  },
  {
    icon: 'albums-outline',
    title: 'Memory',
    body: '12 bytes are reserved for the signature and password. An NTAG213 keeps 132 bytes for content, plenty for a link.',
  },
];

const KEY: Item[] = [
  { icon: 'eye-outline', title: 'Fingerprint', body: 'The short code above identifies your key without revealing it. Long-press it to show the full key.' },
  { icon: 'warning-outline', title: 'Never change the key', body: 'Every activated card is tied to it. A new key means existing cards are no longer recognised.' },
  { icon: 'archive-outline', title: 'Keep a backup', body: 'Store the key in a password manager. If it leaks, someone could make cards imprint accepts.' },
];

const ERRORS: Item[] = [
  { title: 'Chip ignores write protection', body: 'The card was activated but other apps could still change it. Don\'t sell it.' },
  { title: 'Needs an NTAG213/215/216 card', body: 'A different chip type. Use NTAG21x cards.' },
  { title: 'Card has a password from another app', body: 'Already protected elsewhere. It can\'t be activated.' },
  { title: 'Card is locked / settings are locked', body: 'Permanently locked chip. Discard it.' },
  { title: 'Couldn\'t reach card', body: 'The card moved. Hold it still and try again.' },
];

function Section({ heading, items, numbered }: { heading: string; items: Item[]; numbered?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[type.footnote, styles.heading, { color: t.secondary }]}>{heading}</Text>
      <Group>
        {items.map((it, i) => (
          <View key={it.title} style={styles.item}>
            {numbered ? (
              <View style={[styles.num, { borderColor: t.tertiary }]}>
                <Text style={[type.caption, { color: t.text }]}>{i + 1}</Text>
              </View>
            ) : it.icon ? (
              <Ionicons name={it.icon} size={20} color={t.text} style={styles.icon} />
            ) : null}
            <View style={styles.text}>
              <Text style={[type.subhead, { color: t.text, fontWeight: '600' }]}>{it.title}</Text>
              <Text style={[type.footnote, { color: t.secondary }]}>{it.body}</Text>
            </View>
          </View>
        ))}
      </Group>
    </View>
  );
}

/** Admin-only guide shown on the hidden Activate page. */
export function AdminGuide() {
  return (
    <>
      <Section heading="Steps" items={STEPS} numbered />
      <Section heading="How it works" items={HOW} />
      <Section heading="Your secret key" items={KEY} />
      <Section heading="If something goes wrong" items={ERRORS} />
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16 },
  item: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'flex-start' },
  num: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  icon: { marginTop: 1, width: 22 },
  text: { flex: 1, gap: 2 },
});
