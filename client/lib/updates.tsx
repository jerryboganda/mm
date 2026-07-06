/**
 * Self-hosted OTA (over-the-air) update client.
 *
 * Drives the "mandatory update" popup: on launch and whenever the app returns to
 * the foreground it asks the self-hosted update server (see server/routes/updates.ts,
 * configured via app.json `updates.url`) whether a newer JS bundle exists. If so,
 * `available` flips true and the blocking UpdateRequiredModal is shown; tapping
 * "Update now" downloads the bundle and reloads the JS runtime into it.
 *
 * Design rules:
 *  - Native + production only. In dev, Expo Go, or web this is a complete no-op
 *    (`OTA_ACTIVE` is false), so nothing here can ever block those environments.
 *  - A failed/absent check NEVER blocks the app — offline users keep working.
 *  - Checks are throttled so rapid foreground/background cycling can't spam the
 *    server.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import * as Updates from "expo-updates";

export type OtaPhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "error";

interface OtaUpdateContextValue {
  /** True once a newer update is confirmed available (drives the blocking modal). */
  available: boolean;
  phase: OtaPhase;
  /** Human release notes from the pending update's manifest `extra`, if any. */
  releaseNotes: string | null;
  /** Last error message (check or download). Never blocks the app on its own. */
  error: string | null;
  checkNow: () => Promise<void>;
  /** Download the pending update and reload the app into it. */
  applyUpdate: () => Promise<void>;
}

const noop = async () => {};

const OtaUpdateContext = createContext<OtaUpdateContextValue>({
  available: false,
  phase: "idle",
  releaseNotes: null,
  error: null,
  checkNow: noop,
  applyUpdate: noop,
});

// OTA only runs in real native production builds. `Updates.isEnabled` is false in
// Expo Go / dev clients without updates, and `__DEV__` is true while developing.
const OTA_ACTIVE = Platform.OS !== "web" && !__DEV__ && Updates.isEnabled;

const MIN_CHECK_INTERVAL_MS = 60_000;

export function OtaUpdatesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [available, setAvailable] = useState(false);
  const [phase, setPhase] = useState<OtaPhase>("idle");
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);

  const checkNow = useCallback(async () => {
    if (!OTA_ACTIVE) return;
    if (checkingRef.current) return;
    // Already prompting → no need to re-check; the modal is mandatory anyway.
    if (available) return;
    const now = Date.now();
    if (now - lastCheckRef.current < MIN_CHECK_INTERVAL_MS) return;

    checkingRef.current = true;
    lastCheckRef.current = now;
    setError(null);
    setPhase("checking");
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        const extra = (result.manifest as { extra?: Record<string, unknown> })
          ?.extra;
        const notes = extra?.releaseNotes;
        setReleaseNotes(typeof notes === "string" ? notes : null);
        setAvailable(true);
        setPhase("available");
      } else {
        setPhase("idle");
      }
    } catch (e) {
      // Offline, server unreachable, signature mismatch, etc. — do NOT block.
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    } finally {
      checkingRef.current = false;
    }
  }, [available]);

  const applyUpdate = useCallback(async () => {
    if (!OTA_ACTIVE) return;
    setError(null);
    setPhase("downloading");
    try {
      await Updates.fetchUpdateAsync();
      // Reloads the JS runtime into the freshly downloaded bundle.
      await Updates.reloadAsync();
    } catch (e) {
      // Leave the modal up (still "available") so the user can retry.
      setError(e instanceof Error ? e.message : String(e));
      setPhase("available");
    }
  }, []);

  useEffect(() => {
    if (!OTA_ACTIVE) return;
    void checkNow();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void checkNow();
    });
    return () => sub.remove();
  }, [checkNow]);

  return (
    <OtaUpdateContext.Provider
      value={{ available, phase, releaseNotes, error, checkNow, applyUpdate }}
    >
      {children}
    </OtaUpdateContext.Provider>
  );
}

export function useOtaUpdate(): OtaUpdateContextValue {
  return useContext(OtaUpdateContext);
}
