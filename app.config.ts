export default ({ config }: { config: any }) => ({
  ...config,
  expo: {
    ...config.expo,
    name: 'Mefie',
    slug: 'mefie',
    scheme: 'mefie',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    ios: {
      ...config.expo?.ios,
      supportsTablet: true,
      bundleIdentifier: 'app.mefie.mobile',
      associatedDomains: ['applinks:mefie.app'],
    },
    android: {
      ...config.expo?.android,
      package: 'app.mefie.mobile',
      intentFilters: [{
        action: 'VIEW', autoVerify: true,
        data: [{ scheme: 'https', host: 'mefie.app', pathPrefix: '/e' }],
        category: ['BROWSABLE', 'DEFAULT'],
      }],
    },
    extra: {
      ...config.expo?.extra,
      eas: { projectId: process.env.EAS_PROJECT_ID },
    },
  },
});
