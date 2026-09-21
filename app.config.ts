export default ({ config }: { config: any }) => ({
  ...config,
  expo: {
    ...config.expo,
    name: "Mefie",
    slug: "mefie",
    scheme: "mefie",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    plugins: [
      "expo-router",
      "expo-asset",
      [
        "react-native-vision-camera",
        {
          cameraPermission:
            "Mefie needs camera access to capture shared moments.",
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
            "Mefie needs permission to save shared moments to your photo library.",
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
      eas: { projectId: process.env.EAS_PROJECT_ID },
    },
  },
});
