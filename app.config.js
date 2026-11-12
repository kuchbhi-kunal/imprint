// Builds either the public app or the separate admin (activation) app from the same code.
// APP_VARIANT=admin npx expo prebuild --clean  → imprint admin
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'admin') return config;
  return {
    ...config,
    name: 'imprint admin',
    slug: config.slug,
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.admin` },
    android: { ...config.android, package: `${config.android.package}.admin` },
  };
};
