const appEnv = process.env.EXPO_PUBLIC_APP_ENV || 'development';

const isStaging = appEnv === 'staging';
const isProduction = appEnv === 'production';

const base = {
  name: isStaging ? 'Mefie Staging' : 'Mefie',
  slug: 'mefie',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: isStaging ? 'mefie-staging' : 'mefie',
  userInterfaceStyle: 'dark',
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-image-picker',
      {
        photosPermission: 'Mefie needs photo access to save and share your moments.',
      },
    ],
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: isStaging ? 'app.mefie.mobile.staging' : 'app.mefie.mobile',
    associatedDomains: ['applinks:mefie.app'],
    infoPlist: {
      NSCameraUsageDescription: 'Mefie needs camera access to capture shared moments.',
    },
  },
  android: {
    package: isStaging ? 'app.mefie.mobile.staging' : 'app.mefie.mobile',
    permissions: ['CAMERA'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'mefie.app', pathPrefix: '/e' },
          { scheme: 'https', host: 'mefie.app', pathPrefix: '/rejoin' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  extra: {
    router: {
      origin: false,
    },
  },
};

module.exports = {
  expo: {
    ...base,
    extra: {
      ...base.extra,
      appEnv,
      isProduction,
    },
  },
};
