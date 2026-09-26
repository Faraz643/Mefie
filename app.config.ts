export default ({ config }: { config: any }) => {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV || "development";
  const isDevelopment = appEnv === "development";
  const isStaging = appEnv === "staging";

  const appName = isDevelopment ? "Mefie Dev" : isStaging ? "Mefie Staging" : "Mefie";
  const scheme = isDevelopment ? "mefie-dev" : isStaging ? "mefie-staging" : "mefie";
  const bundleIdentifier = isDevelopment
    ? "app.mefie.mobile.dev"
    : isStaging
      ? "app.mefie.mobile.staging"
      : "app.mefie.mobile";

  return {
    ...config,
    expo: {
      ...config.expo,
      owner: "farazbuilds_ai",
      name: appName,
      slug: "mefie",
      scheme,
      version: "1.0.0",
      runtimeVersion: {
        policy: "appVersion",
      },
      updates: {
        url: "https://u.expo.dev/99e135d4-fc2a-4c7c-b33a-8a93d3ea803a",
      },
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
        bundleIdentifier,
        associatedDomains: ["applinks:mefie.app"],
      },
      android: {
        ...config.expo?.android,
        package: bundleIdentifier,
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
  };
};
