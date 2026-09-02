const { withAndroidManifest } = require("expo/config-plugins");

const GMS_BARCODE_DELEGATE_ACTIVITY =
  "com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity";

const TOOLS_NS = "http://schemas.android.com/tools";

/**
 * Android 16 large-screen compatibility fix.
 *
 * The `play-services-code-scanner` AAR (bundled by expo-camera) declares
 * `GmsBarcodeScanningDelegateActivity` with `android:screenOrientation="PORTRAIT"`.
 * Google Play flags any locked-orientation activity on Android 16 large-screen
 * devices (tablets, foldables, multi-window).
 *
 * The latest AAR release still ships the lock, so this plugin re-declares the
 * activity with `android:screenOrientation="fullUser"` and `tools:replace`
 * so the manifest merger overrides the library value instead of failing.
 * `fullUser` follows the user's rotation settings on large screens while
 * keeping normal behavior on phones, and scanner functionality is unaffected.
 */
function withMlkitScannerLargeScreenFix(config) {
  return withAndroidManifest(config, (config) => {
    // `modResults` shape: { manifest: { $: {<root attrs>}, application: [...] } }
    const manifestElement = config.modResults.manifest;
    if (!manifestElement || !manifestElement.$) {
      return config;
    }

    // Ensure the tools namespace is declared on the real <manifest> root.
    manifestElement.$["xmlns:tools"] =
      manifestElement.$["xmlns:tools"] || TOOLS_NS;

    const application = manifestElement.application?.[0];
    if (!application) {
      return config;
    }

    const activities = application.activity || [];

    let delegate = activities.find(
      (a) => a && a.$ && a.$["android:name"] === GMS_BARCODE_DELEGATE_ACTIVITY,
    );

    if (!delegate) {
      delegate = { $: { "android:name": GMS_BARCODE_DELEGATE_ACTIVITY } };
      activities.push(delegate);
      application.activity = activities;
    }

    delegate.$["android:screenOrientation"] = "fullUser";
    delegate.$["tools:replace"] = "android:screenOrientation";

    return config;
  });
}

module.exports = withMlkitScannerLargeScreenFix;
