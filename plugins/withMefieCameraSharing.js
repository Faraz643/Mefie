const { withAndroidManifest, withDangerousMod, withMainApplication, AndroidConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PKG = "com.mefie.camerasharing";
const SRC = path.resolve(__dirname, "native", "android", "com", "mefie", "camerasharing");
const FILES = ["MefieCameraSharingModule.java","MefieCameraSharingPackage.java","MefieCameraSharingService.java","MefiePhotoHeadlessService.java"];

function withSources(config) {
  return withDangerousMod(config, ["android", async config => {
    const target = path.join(config.modRequest.platformProjectRoot, "app", "src", "main", "java", ...PKG.split("."));
    if (!fs.existsSync(SRC)) throw new Error("Mefie camera-sharing native sources are missing.");
    fs.mkdirSync(target, { recursive: true });
    for (const file of FILES) {
      const source = path.join(SRC, file);
      if (!fs.existsSync(source)) throw new Error("Missing native source: " + file);
      fs.copyFileSync(source, path.join(target, file));
    }
    return config;
  }]);
}

function withManifest(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    const permissions = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_EXTERNAL_STORAGE"
    ];
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const permission of permissions) {
      if (!manifest["uses-permission"].some(x => x?.$?.["android:name"] === permission)) {
        manifest["uses-permission"].push({ $: { "android:name": permission } });
      }
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app.service = app.service || [];
    const upsert = (name, attrs) => {
      const existing = app.service.find(x => x?.$?.["android:name"] === name);
      if (existing) Object.assign(existing.$, attrs);
      else app.service.push({ $: { "android:name": name, ...attrs } });
    };

    const serviceName = PKG + ".MefieCameraSharingService";
    upsert(serviceName, {
      "android:exported": "false",
      "android:foregroundServiceType": "specialUse",
      "android:stopWithTask": "false"
    });
    upsert(PKG + ".MefiePhotoHeadlessService", { "android:exported": "false" });

    const service = app.service.find(x => x?.$?.["android:name"] === serviceName);
    service.property = service.property || [];
    const property = "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE";
    if (!service.property.some(x => x?.$?.["android:name"] === property)) {
      service.property.push({
        $: {
          "android:name": property,
          "android:value": "User-controlled real-time photo sharing from the phone camera."
        }
      });
    }
    return config;
  });
}

function withPackage(config) {
  return withMainApplication(config, config => {
    let source = config.modResults.contents;
    const importLine = "import " + PKG + ".MefieCameraSharingPackage;";
    if (!source.includes(importLine)) {
      const packageMatch = source.match(/^package\s+[^;\n]+;?/m);
      source = packageMatch ? source.replace(packageMatch[0], packageMatch[0] + "\n" + importLine) : importLine + "\n" + source;
    }
    if (!source.includes("MefieCameraSharingPackage()")) {
      const java = /(List<ReactPackage>\s+packages\s*=\s*new\s+PackageList\([^;]+\)\.getPackages\(\);)/;
      const kotlin = /(val\s+packages\s*=\s*PackageList\([^\n]+\)\.packages)/;
      const apply = /(PackageList\(this\)\.packages\.apply\s*\{)/;
      if (java.test(source)) source = source.replace(java, "$1\n      packages.add(new MefieCameraSharingPackage());");
      else if (kotlin.test(source)) source = source.replace(kotlin, "$1\n          packages.add(MefieCameraSharingPackage())");
      else if (apply.test(source)) source = source.replace(apply, "$1\n          add(MefieCameraSharingPackage())");
      else throw new Error("Mefie camera-sharing plugin could not locate MainApplication package registration.");
    }
    config.modResults.contents = source;
    return config;
  });
}

module.exports = function withMefieCameraSharing(config) {
  config = withSources(config);
  config = withManifest(config);
  config = withPackage(config);
  return config;
};