// Two apps from one codebase:
//   APP_VARIANT=admin → "imprint admin" (activation tools)
//   default           → "imprint" (public) — `src/admin` resolves to index.public.ts stubs,
//                       so admin/activation code is not bundled at all.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (process.env.APP_VARIANT !== 'admin') {
  config.resolver.sourceExts = ['public.ts', 'public.tsx', ...config.resolver.sourceExts];
}
module.exports = config;
