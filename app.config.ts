export default ({ config }: { config: any }) => ({
  ...config,
  expo: {
    ...config.expo,
    owner: "farazbuilds_ai",
    name: "Mefie",
    slug: "mefie",
    scheme: "mefie",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    plugins: [
      "expo-router",
      "expo-dev-client",
      "expo-asset",
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          organization: process.env.SENTRY_ORG || undefined,
          project: process.env.SENTRY_PROJECT || undefined,
          disableAutoUpload: !process.env.SENTRY_AUTH_TOKEN,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Mefie needs photo access to save and share your moments.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "Mefie needs permission to save your shared moments to your photo library.",
          savePhotosPermission:
            "Mefie needs permission to save shared moments to your photo library.",
        },
      ],
    ],
    ios: {
      ...config.expo?.ios,
      supportsTablet: true,
      bundleIdentifier: "app.mefie.mobile",
      associatedDomains: ["applinks:mefie.app"],
    },
    android: {
      ...config.expo?.android,
      package: "app.mefie.mobile",
      softwareKeyboardLayoutMode: "resize",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [{ scheme: "https", host: "mefie.app", pathPrefix: "/e" }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    extra: {
      ...config.expo?.extra,
      eas: { projectId: "99e135d4-fc2a-4c7c-b33a-8a93d3ea803a" },
    },
  },
});
