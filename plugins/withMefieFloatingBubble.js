const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
  AndroidConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NATIVE_PACKAGE = "com.mefie.floating";
const NATIVE_SOURCE_DIR = path.join(__dirname, "native", "android", "com", "mefie", "floating");
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
    fs.mkdirSync(targetDir, { recursive: true });
    for (const file of SERVICE_CLASSES) {
      fs.copyFileSync(path.join(NATIVE_SOURCE_DIR, file), path.join(targetDir, file));
    }
    return config;
  }]);
}

function withMefieManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ || {};
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
    const serviceName = `${NATIVE_PACKAGE}.MefieFloatingBubbleService`;
    const headlessName = `${NATIVE_PACKAGE}.MefiePhotoHeadlessService`;

    const upsertService = (name, attrs) => {
      const existing = application.service.find((service) => service?.$?.["android:name"] === name);
      if (existing) Object.assign(existing.$, attrs);
      else application.service.push({ $: { "android:name": name, ...attrs } });
    };

    upsertService(serviceName, {
      "android:exported": "false",
      "android:foregroundServiceType": "specialUse",
      "android:stopWithTask": "false",
    });
    upsertService(headlessName, { "android:exported": "false" });

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
      if (packageMatch) {
        source = source.replace(packageMatch[0], `${packageMatch[0]}\n${importLine}`);
      } else {
        source = `${importLine}\n${source}`;
      }
    }

    if (!source.includes("new MefieFloatingBubblePackage()")) {
      const listPattern = /(List<ReactPackage>\s+packages\s*=\s*new\s+PackageList\([^;]+\)\.getPackages\(\);)/;
      if (listPattern.test(source)) {
        source = source.replace(listPattern, `$1\n      packages.add(new MefieFloatingBubblePackage());`);
      } else {
        const kotlinPattern = /(val\s+packages\s*=\s*PackageList\([^\n]+\)\.packages)/;
        if (kotlinPattern.test(source)) {
          source = source.replace(kotlinPattern, `$1\n          packages.add(MefieFloatingBubblePackage())`);
        } else {
          throw new Error("Mefie floating bubble plugin could not locate the React package list in MainApplication.");
        }
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
