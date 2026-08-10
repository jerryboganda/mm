# Design Specification: Google Play Console Recommendations Fix

**Date**: 2026-08-10  
**Status**: Approved by User  
**Target File**: `app.json`

---

## 1. Objective
Resolve 3 specific recommendations flagged by Google Play Console for the Maternal Mind Android Student App:
1. **Edge-to-Edge Deprecation**: Remove deprecated `edgeToEdgeEnabled` flag.
2. **Large Screen Support**: Remove orientation restrictions and support resizability on tablets, foldables, and Chromebooks.
3. **R8 Performance & Memory Optimization**: Enable R8 code shrinking and resource shrinking for Android release builds.

---

## 2. Detailed Fixes

### 2.1 Fix Deprecated Edge-to-Edge Parameter
In `app.json` -> `expo.android`:
- Remove: `"edgeToEdgeEnabled": true`
- Android 15 / Expo SDK 54 handles edge-to-edge natively via `react-native-safe-area-context` and `expo-system-ui`.

### 2.2 Unlocking Orientation & Resizability for Large Screens
In `app.json` -> `expo`:
- Change `"orientation": "portrait"` to `"orientation": "default"`
In `app.json` -> `expo.android`:
- Add `"supportsTablet": true`

### 2.3 R8 Code & Resource Minification
In `app.json` -> `expo.plugins` -> `expo-build-properties`:
- Update configuration:
```json
[
  "expo-build-properties",
  {
    "android": {
      "usesCleartextTraffic": false,
      "enableMinifyInReleaseBuilds": true,
      "enableShrinkResourcesInReleaseBuilds": true
    }
  }
]
```

---

## 3. Verification Plan
- Validate `app.json` JSON syntax.
- Run `npx expo config` to verify Expo reads the updated configuration without warnings.
- Run `npx tsc --noEmit` to verify zero project errors.
- Stage and commit changes.
