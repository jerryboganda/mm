# Self-Hosted OTA Updates — Operator Runbook

This app ships JavaScript/asset/content updates **over-the-air (OTA)** from our own
VPS, with a **mandatory in-app "Update Required" popup**. No EAS, no store round-trip
for routine changes, no ongoing cost.

- **Client:** `expo-updates` (see `app.json` → `updates`), driven by
  [`client/lib/updates.tsx`](../client/lib/updates.tsx) +
  [`client/components/UpdateRequiredModal.tsx`](../client/components/UpdateRequiredModal.tsx).
- **Server:** self-hosted Expo Updates protocol endpoint at `/updates/manifest` +
  `/updates/assets` — [`server/routes/updates.ts`](../server/routes/updates.ts),
  [`server/lib/expo-updates.ts`](../server/lib/expo-updates.ts).
- **Publishing:** [`.github/workflows/ota-publish.yml`](../.github/workflows/ota-publish.yml)
  runs `expo export` and rsyncs the bundle to the VPS on every push to `main`.

> **OTA updates JS/assets/content only — never native code.** Adding a native
> module, bumping the Expo SDK, or changing native config in `app.json` changes the
> **runtime version** (fingerprint policy) and requires a new **store build** before
> those users can receive OTA again. Use `android-release.yml` (Android) / EAS (iOS).

---

## How it works (steady state)

```
git push main ──▶ GitHub Actions (ota-publish.yml)
                    • resolve runtime version (fingerprint, per platform)
                    • npx expo export  (ios + android)
                    • rsync dist/ ──▶ VPS:/root/maternal-mind/updates/<rtv>/<ts>/
                                          │
Installed app ◀── GET /updates/manifest ─┘   (signed manifest)
   • on launch + foreground → checkForUpdateAsync()
   • newer bundle? → blocking "Update Required" popup
   • tap "Update Now" → fetchUpdateAsync() → reloadAsync()
```

---

## One-time bootstrap

### 1. Code-signing keys

Already generated (run `scripts/generate-code-signing-keys.ps1`/`.sh` to regenerate):

- `client/certs/certificate.pem` — **public** cert, committed, bundled into the app.
- `secrets/code-signing-private-key.pem` — **private** key, git-ignored, **Hostinger Server only**.

Copy the private key to Hostinger (never commit it, never email it):

```bash
scp -P 6588 secrets/code-signing-private-key.pem u776151780@maternalmind.com.pk:~/domains/maternalmind.com.pk/public_html/secrets/code-signing-private-key.pem
```

### 2. Hostinger Production Server

```bash
ssh -p 6588 u776151780@maternalmind.com.pk
cd ~/domains/maternalmind.com.pk/public_html
mkdir -p updates secrets                       # bind-mount targets
chmod 600 secrets/code-signing-private-key.pem
curl -s -H "expo-platform: android" -H "expo-runtime-version: test" \
     -H "expo-protocol-version: 1" \
     http://127.0.0.1:5000/updates/manifest     # expect a noUpdateAvailable directive
```

Check the app logs say `Expo Updates: code signing ENABLED`.

### 3. GitHub repository secrets & variables

**Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret | Value |
|---|---|
| `HOSTINGER_SSH_KEY` | private SSH key of a user that can write to Hostinger |
| `HOSTINGER_HOST` | `maternalmind.com.pk` |
| `HOSTINGER_USER` | `u776151780` |
| `HOSTINGER_PORT` | `6588` |

For `android-release.yml` also: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and optionally `PLAY_SERVICE_ACCOUNT_JSON`.

**Variables** (Actions → Variables):

| Variable | Value |
|---|---|
| `OTA_ENABLED` | `false` for now — flip to `true` in step 5 |
| `VPS_UPDATES_DIR` | (optional) defaults to `/root/maternal-mind/updates` |

### 4. Ship ONE store build that embeds the OTA engine

This is the only unavoidable manual build — it puts `expo-updates` on devices.

- **Android:** run the **Android Release Build** workflow (or `eas build -p android`),
  download the AAB, upload to Google Play, roll out.
- **iOS:** `eas build -p ios --profile production` then submit to the App Store.

Because `app.json` already contains the `updates` block + `certificate.pem`, these
builds phone home to our server and verify signatures automatically.

### 5. Go live

Once the store build is out and users have it, set repo variable **`OTA_ENABLED=true`**.
From now on, every push to `main` that touches `client/**`, `assets/**`, `shared/**`,
or `app.json` publishes an OTA update automatically.

---

## Day-to-day

1. Make a JS/UI/content change.
2. `git push` to `main` (your auto-sync already does this).
3. `ota-publish.yml` builds and publishes to the VPS.
4. Users get the mandatory popup on next foreground → one tap → updated.

Custom release notes: run the workflow manually (Actions → OTA Publish → Run workflow)
and fill in **release_notes**; otherwise the latest commit subject is used. The text
shows in the popup (via `manifest.extra.releaseNotes`).

---

## When you DO need a new store build

The fingerprint runtime version changes automatically when native inputs change
(native deps, SDK, native `app.json` config). After such a change, existing installs
**stop receiving OTA** (by design — the JS would be incompatible) until you ship a new
store build. Symptom: `ota-publish` publishes under a new `<runtimeVersion>` folder that
old apps don't request. Fix: run `android-release.yml` / EAS iOS and submit to stores.

---

## Rollback

Updates live in `/root/maternal-mind/updates/<runtimeVersion>/<timestamp>/`. The server
always serves the **newest** timestamp. To roll back, remove the bad one:

```bash
cd /root/maternal-mind/updates/<runtimeVersion>
ls -1dt */                 # newest first
rm -rf <bad-timestamp>/     # clients fall back to the previous update
```

(No restart needed — the manifest endpoint reads the directory per request.)

---

## Security notes

- The signing **private key never leaves the VPS** and is never in git or the Docker
  image (it's a read-only bind mount). The app only runs bundles signed by it.
- `/updates/manifest` is `no-store`; assets are content-addressed and cached immutably.
- Rotating keys requires a new store build (the cert is embedded in the binary).
