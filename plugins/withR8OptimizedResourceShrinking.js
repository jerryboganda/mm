const { withGradleProperties } = require("expo/config-plugins");

/**
 * Enables the optimized R8 resource-shrinking pipeline (AGP 8.12+).
 *
 * `android.r8.optimizedResourceShrinking=true` makes R8 trace resource and
 * code references together, removing resources reachable only from dead code.
 * This is what Google Play Console refers to as "Optimized resource shrinking";
 * from AGP 9.0 it becomes the default, and this property is the supported way
 * to opt in on AGP 8.12 (the version shipped with React Native 0.86).
 *
 * Requires `minifyEnabled` + `shrinkResources` in release, which the app
 * already enables via expo-build-properties
 * (android.enableMinifyInReleaseBuilds / android.enableShrinkResourcesInReleaseBuilds).
 */
function withR8OptimizedResourceShrinking(config) {
  return withGradleProperties(config, (config) => {
    const key = "android.r8.optimizedResourceShrinking";
    const items = config.modResults;
    const existing = items.find((item) => item && item.type === "property" && item.key === key);

    if (existing) {
      existing.value = "true";
    } else {
      items.push({ type: "property", key, value: "true" });
    }

    return config;
  });
}

module.exports = withR8OptimizedResourceShrinking;
