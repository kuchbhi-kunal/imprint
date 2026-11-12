import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, useAnimatedValue } from 'react-native';
import { haptic } from './ui';

// Keep the native launch screen (grey mark on black) up until this overlay is drawn.
SplashScreen.preventAutoHideAsync().catch(() => {});
try {
  SplashScreen.setOptions({ fade: false, duration: 0 });
} catch {
  // not supported on every platform/version
}

/** Must match `imageWidth` of the expo-splash-screen plugin in app.json, so the swap is seamless. */
const SIZE = 140;
const MARK = require('../assets/splash-icon.png');
const DIM = '#48484A';

/** Ridge layers of the mark, ordered inner -> outer (pad first). Together they equal MARK. */
const RIDGES = [
  require('../assets/splash-ridges/ridge-0.png'),
  require('../assets/splash-ridges/ridge-1.png'),
  require('../assets/splash-ridges/ridge-2.png'),
  require('../assets/splash-ridges/ridge-3.png'),
  require('../assets/splash-ridges/ridge-4.png'),
  require('../assets/splash-ridges/ridge-5.png'),
];

const STEP = 190; // gap between ridges starting to light up
const LIGHT = 650; // each ridge's fade from grey to white (long + overlapping = a smooth flowing glow)

/**
 * Launch animation, like a lock-screen fingerprint scan: the mark starts dim grey (identical to the
 * native launch screen), then its ridges light up one at a time from the centre out, it pulses once,
 * and the overlay fades into the app. ~2.5s total. All animations run on the native UI thread.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const [lit] = useState(() => RIDGES.map(() => new Animated.Value(0)));
  const pulse = useAnimatedValue(1);
  const fade = useAnimatedValue(1);
  // Swap from the native launch screen only once every image has decoded, so the mark never blinks.
  const [loaded, setLoaded] = useState(0);
  const [laidOut, setLaidOut] = useState(false);
  const ready = laidOut && loaded >= RIDGES.length + 1;
  const onImageLoad = () => setLoaded((n) => n + 1);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    Animated.sequence([
      Animated.delay(300),
      Animated.stagger(
        STEP,
        lit.map((v) => Animated.timing(v, { toValue: 1, duration: LIGHT, easing: Easing.inOut(Easing.sin), useNativeDriver: true })),
      ),
    ]).start(() => {
      haptic.success();
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(350),
        Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(() => onDone());
    });
  }, [ready, lit, pulse, fade, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} onLayout={() => setLaidOut(true)}>
      <Animated.View style={{ width: SIZE, height: SIZE, transform: [{ scale: pulse }] }}>
        <Image source={MARK} style={styles.mark} tintColor={DIM} onLoad={onImageLoad} fadeDuration={0} />
        {RIDGES.map((src, i) => (
          <Animated.View key={i} style={[styles.layer, { opacity: lit[i] }]}>
            <Image source={src} style={styles.mark} onLoad={onImageLoad} fadeDuration={0} />
          </Animated.View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  mark: { width: SIZE, height: SIZE },
  layer: { position: 'absolute', left: 0, top: 0 },
});
