/** Monochrome palette, iOS-style. The app is dark mode only. */
const dark = {
  dark: true,
  bg: '#000000',
  surface: '#161618',
  thumb: '#3A3A3C',
  text: '#FFFFFF',
  secondary: '#8D8D93',
  tertiary: '#48484A',
  separator: 'rgba(84,84,88,0.45)',
  inverse: '#000000',
  scrim: 'rgba(0,0,0,0.6)',
  sheet: '#1C1C1E',
  // Status accents (Apple's dark-mode system colors), used sparingly.
  success: '#30D158',
  successSoft: 'rgba(48,209,88,0.12)',
  danger: '#FF453A',
  dangerLine: 'rgba(255,69,58,0.45)',
};

export type Theme = typeof dark;

export function useTheme(): Theme {
  return dark;
}

/** iOS type scale. */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41 },
  subhead: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.07 },
};
