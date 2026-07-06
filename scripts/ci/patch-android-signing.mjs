/**
 * CI helper: inject a release signing config into the Expo-prebuilt Android
 * project so `gradlew bundleRelease` produces an upload-key-signed AAB.
 *
 * Expo's `prebuild` generates `android/app/build.gradle` with the release build
 * type signed by the DEBUG key (fine for local dev, rejected by Play). This script
 * adds a `release` signingConfig that reads credentials from gradle.properties
 * (populated from CI secrets) and points the release build type at it.
 *
 * It targets the Expo SDK 54 template. If the template changes and the markers
 * below aren't found, it exits non-zero so the workflow fails loudly rather than
 * shipping a debug-signed build.
 *
 * Usage: node scripts/ci/patch-android-signing.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const buildGradlePath = "android/app/build.gradle";
let gradle = readFileSync(buildGradlePath, "utf-8");

if (gradle.includes("signingConfigs.release")) {
  console.log("Release signing config already present — nothing to do.");
  process.exit(0);
}

// 1. Add a `release` signing config right after the opening of `signingConfigs {`.
const signingConfigsMarker = "signingConfigs {";
const idx = gradle.indexOf(signingConfigsMarker);
if (idx === -1) {
  console.error("Could not find `signingConfigs {` in build.gradle");
  process.exit(1);
}
const releaseSigningConfig = `
        release {
            storeFile file(MM_UPLOAD_STORE_FILE)
            storePassword MM_UPLOAD_STORE_PASSWORD
            keyAlias MM_UPLOAD_KEY_ALIAS
            keyPassword MM_UPLOAD_KEY_PASSWORD
        }`;
gradle =
  gradle.slice(0, idx + signingConfigsMarker.length) +
  releaseSigningConfig +
  gradle.slice(idx + signingConfigsMarker.length);

// 2. Point the release build type at the release signing config. The template's
//    release build type ships with `signingConfig signingConfigs.debug`; it is the
//    LAST such reference in the file (debug build type has the first).
const debugRef = "signingConfig signingConfigs.debug";
const lastRef = gradle.lastIndexOf(debugRef);
if (lastRef === -1) {
  console.error(
    "Could not find a `signingConfig signingConfigs.debug` to repoint",
  );
  process.exit(1);
}
gradle =
  gradle.slice(0, lastRef) +
  "signingConfig signingConfigs.release" +
  gradle.slice(lastRef + debugRef.length);

writeFileSync(buildGradlePath, gradle);
console.log("Patched android/app/build.gradle with release signing config.");
