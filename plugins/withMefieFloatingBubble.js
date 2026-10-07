/*
  FLOATING CAMERA FEATURE DISABLED.
  Replaced by the Android persistent notification camera-sharing controls.
  Original implementation intentionally retained here for reference only.

const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
  AndroidConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NATIVE_PACKAGE = "com.mefie.floating";
const NATIVE_SOURCE_DIR = path.resolve(__dirname, "native", "android", "com", "mefie", "floating");
const SERVICE_CLASSES = [
  "MefieFloatingBubbleModule.java",
  "MefieFloatingBubblePackage.java",
  "MefieFloatingBubbleService.java",
  "MefiePhotoHeadlessService.java",
];

function withMefieNativeSources(config) {
  return withDangerousMod(config, ["android", async (config) => {
    const targetDir = path.join(
      config.modRequest.platformProjectRoot,
      "app",
      "src",
      "main",
      "java",
      ...NATIVE_PACKAGE.split("."),
    );

    if (!fs.existsSync(NATIVE_SOURCE_DIR)) {
      throw new Error(
        `Mefie native Android source directory is missing from the build archive: ${NATIVE_SOURCE_DIR}`,
      );
    }

    fs.mkdirSync(targetDir, { recursive: true });

    for (const file of SERVICE_CLASSES) {
      const source = path.join(NATIVE_SOURCE_DIR, file);
      if (!fs.existsSync(source)) {
        throw new Error(`Mefie native Android source file is missing from the build archive: ${source}`);
      }
      fs.copyFileSync(source, path.join(targetDir, file));
    }

    return config;
  }]);
}

function withMefieManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.WAKE_LOCK",
    ];
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const permission of permissions) {
      if (!manifest["uses-permission"].some((item) => item?.$?.["android:name"] === permission)) {
        manifest["uses-permission"].push({ $: { "android:name": permission } });
      }
    }

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.service = application.service || [];
    const upsertService = (name, attrs) => {
      const existing = application.service.find((service) => service?.$?.["android:name"] === name);
      if (existing) Object.assign(existing.$, attrs);
      else application.service.push({ $: { "android:name": name, ...attrs } });
    };

    upsertService(`${NATIVE_PACKAGE}.MefieFloatingBubbleService`, {
      "android:exported": "false",
      "android:foregroundServiceType": "specialUse",
      "android:stopWithTask": "false",
    });
    upsertService(`${NATIVE_PACKAGE}.MefiePhotoHeadlessService`, { "android:exported": "false" });

    application.property = application.property || [];
    const propertyName = "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE";
    if (!application.property.some((item) => item?.$?.["android:name"] === propertyName)) {
      application.property.push({
        $: {
          "android:name": propertyName,
          "android:value": "User-controlled floating camera sharing overlay",
        },
      });
    }
    return config;
  });
}

function withMefieMainApplication(config) {
  return withMainApplication(config, (config) => {
    let source = config.modResults.contents;
    const importLine = `import ${NATIVE_PACKAGE}.MefieFloatingBubblePackage;`;
    if (!source.includes(importLine)) {
      const packageMatch = source.match(/^package\s+[^;\n]+;?/m);
      source = packageMatch ? source.replace(packageMatch[0], `${packageMatch[0]}\n${importLine}`) : `${importLine}\n${source}`;
    }

    const registrationMarker = "MefieFloatingBubblePackage()";
    if (!source.includes(registrationMarker)) {
      const javaPattern = /(List<ReactPackage>\s+packages\s*=\s*new\s+PackageList\([^;]+\)\.getPackages\(\);)/;
      const kotlinValPattern = /(val\s+packages\s*=\s*PackageList\([^\n]+\)\.packages)/;
      const kotlinApplyPattern = /(PackageList\(this\)\.packages\.apply\s*\{)/;

      if (javaPattern.test(source)) {
        source = source.replace(javaPattern, `$1\n      packages.add(new MefieFloatingBubblePackage());`);
      } else if (kotlinValPattern.test(source)) {
        source = source.replace(kotlinValPattern, `$1\n          packages.add(MefieFloatingBubblePackage())`);
      } else if (kotlinApplyPattern.test(source)) {
        source = source.replace(kotlinApplyPattern, `$1\n          add(MefieFloatingBubblePackage())`);
      } else {
        throw new Error("Mefie floating bubble plugin could not locate the React package list in MainApplication.");
      }
    }

    config.modResults.contents = source;
    return config;
  });
}

module.exports = function withMefieFloatingBubble(config) {
  config = withMefieNativeSources(config);
  config = withMefieManifest(config);
  config = withMefieMainApplication(config);
  return config;
};

*/
