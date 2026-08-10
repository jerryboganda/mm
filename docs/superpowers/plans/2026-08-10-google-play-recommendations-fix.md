# Google Play Console Recommendations Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Google Play Console recommendations regarding edge-to-edge deprecation, large screen resizability/orientation, and R8 optimization for the Android app.

**Architecture:** Update `app.json` configuration for Expo SDK 54 / Android 15: unlock orientation to `"default"`, enable `"supportsTablet": true` on Android, remove deprecated `"edgeToEdgeEnabled": true`, and enable R8 minification & resource shrinking in `expo-build-properties`.

**Tech Stack:** Expo SDK 54, React Native, Android Gradle / R8 optimizer.

## Global Constraints
- `app.json` must remain valid JSON.
- `npx expo config` must evaluate cleanly without warnings or errors.

---

### Task 1: Update `app.json` Android & Expo Build Configurations

**Files:**
- Modify: `app.json`

**Interfaces:**
- Consumes: Expo app configuration parameters.
- Produces: Updated Android edge-to-edge, orientation, tablet support, and R8 optimizer properties.

- [ ] **Step 1: Update `app.json`**

In `app.json`:
1. Change `"orientation": "portrait"` to `"orientation": "default"`.
2. In `"android"` block:
   - Remove `"edgeToEdgeEnabled": true`.
   - Add `"supportsTablet": true`.
3. In `"plugins"` array -> `"expo-build-properties"` item:
   - Update `android` properties:
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

- [ ] **Step 2: Validate Expo configuration**

Run: `npx expo config`  
Expected: Output parsed app config cleanly without errors.

- [ ] **Step 3: Run TypeScript typecheck**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add app.json
git commit -m "fix(android): resolve google play console recommendations for edge-to-edge, orientation, and R8 minification"
```
