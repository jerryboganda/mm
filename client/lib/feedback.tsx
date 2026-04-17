/**
 * Feedback Preferences Context
 *
 * Persists user's Sound Effects and Haptic Feedback preferences to AsyncStorage.
 * Provides `playHaptic()` and `playSound()` helpers that respect preferences.
 * Other modules import from here (or from the haptics-wrapper) to honour settings.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

// ── AsyncStorage keys ────────────────────────────────────────────
const KEY_SOUND_EFFECTS = "@mm_pref_sound_effects";
const KEY_HAPTIC_FEEDBACK = "@mm_pref_haptic_feedback";

// ── Bundled sound assets ─────────────────────────────────────────
const SOUNDS = {
  tap: require("../../assets/sounds/tap.wav"),
  success: require("../../assets/sounds/success.wav"),
  error: require("../../assets/sounds/error.wav"),
} as const;

/** Union type of available bundled sound asset names. */
export type SoundName = keyof typeof SOUNDS;

/** Describes the feedback preferences and playback helpers exposed by the context. */
// ── Context type ─────────────────────────────────────────────────
interface FeedbackContextValue {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  setHapticEnabled: (v: boolean) => void;
  /** Fire haptic only if enabled. Drop-in replacement for expo-haptics calls. */
  playHaptic: (
    type?: "impact" | "notification" | "selection",
    style?: Haptics.ImpactFeedbackStyle | Haptics.NotificationFeedbackType,
  ) => void;
  /** Play a named sound only if enabled. */
  playSound: (name: SoundName) => void;
}

const FeedbackContext = createContext<FeedbackContextValue>({
  soundEnabled: true,
  hapticEnabled: true,
  setSoundEnabled: () => {},
  setHapticEnabled: () => {},
  playHaptic: () => {},
  playSound: () => {},
});

// ── Singleton refs for use outside React tree (haptics-wrapper) ──
let _hapticEnabled = true;
let _soundEnabled = true;

/**
 * Returns whether haptic feedback is currently enabled.
 * Can be called outside the React tree (e.g. from `haptics-wrapper`).
 *
 * @returns `true` if haptic feedback is enabled.
 */
export function getHapticEnabled(): boolean {
  return _hapticEnabled;
}
/**
 * Returns whether sound effects are currently enabled.
 * Can be called outside the React tree (e.g. from `haptics-wrapper`).
 *
 * @returns `true` if sound effects are enabled.
 */
export function getSoundEnabled(): boolean {
  return _soundEnabled;
}

/**
 * Context provider that persists sound and haptic preferences to AsyncStorage,
 * and exposes `playHaptic` / `playSound` helpers that respect those preferences.
 *
 * @param props.children - Child components that will have access to the feedback context.
 * @returns A provider component wrapping children with feedback controls.
 */
// ── Provider ─────────────────────────────────────────────────────
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, _setSoundEnabled] = useState(true);
  const [hapticEnabled, _setHapticEnabled] = useState(true);
  const soundCache = useRef<Map<SoundName, Audio.Sound>>(new Map());

  // Restore from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const [s, h] = await Promise.all([
          AsyncStorage.getItem(KEY_SOUND_EFFECTS),
          AsyncStorage.getItem(KEY_HAPTIC_FEEDBACK),
        ]);
        if (s !== null) {
          const val = s === "true";
          _setSoundEnabled(val);
          _soundEnabled = val;
        }
        if (h !== null) {
          const val = h === "true";
          _setHapticEnabled(val);
          _hapticEnabled = val;
        }
      } catch {
        // defaults stay true
      } finally {
        // preferences loaded
      }
    })();
  }, []);

  // Configure audio session for mixing with other audio
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    _setSoundEnabled(v);
    _soundEnabled = v;
    AsyncStorage.setItem(KEY_SOUND_EFFECTS, String(v)).catch(() => {});
  }, []);

  const setHapticEnabled = useCallback((v: boolean) => {
    _setHapticEnabled(v);
    _hapticEnabled = v;
    AsyncStorage.setItem(KEY_HAPTIC_FEEDBACK, String(v)).catch(() => {});
  }, []);

  const playHaptic = useCallback(
    (
      type: "impact" | "notification" | "selection" = "impact",
      style?: Haptics.ImpactFeedbackStyle | Haptics.NotificationFeedbackType,
    ) => {
      if (!_hapticEnabled || Platform.OS === "web") return;
      switch (type) {
        case "impact":
          Haptics.impactAsync(
            (style as Haptics.ImpactFeedbackStyle) ??
              Haptics.ImpactFeedbackStyle.Light,
          );
          break;
        case "notification":
          Haptics.notificationAsync(
            (style as Haptics.NotificationFeedbackType) ??
              Haptics.NotificationFeedbackType.Success,
          );
          break;
        case "selection":
          Haptics.selectionAsync();
          break;
      }
    },
    [],
  );

  const playSound = useCallback(async (name: SoundName) => {
    if (!_soundEnabled || Platform.OS === "web") return;
    try {
      // Re-use cached sound object when possible
      let sound = soundCache.current.get(name);
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.setPositionAsync(0);
          await sound.playAsync();
          return;
        }
        // Sound was unloaded, remove from cache
        soundCache.current.delete(name);
      }
      // Create fresh
      const { sound: newSound } = await Audio.Sound.createAsync(SOUNDS[name], {
        shouldPlay: true,
        volume: 0.5,
      });
      soundCache.current.set(name, newSound);
    } catch (e) {
      // Silent fail — sounds are non-critical
      console.warn("[Feedback] Sound play failed:", e);
    }
  }, []);

  // Cleanup sounds on unmount
  useEffect(() => {
    const cache = soundCache.current;
    return () => {
      cache.forEach((s) => s.unloadAsync().catch(() => {}));
    };
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        soundEnabled,
        hapticEnabled,
        setSoundEnabled,
        setHapticEnabled,
        playHaptic,
        playSound,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

/**
 * Hook to access feedback preferences and playback helpers.
 *
 * @returns The current {@link FeedbackContextValue}.
 */
export function useFeedback() {
  return useContext(FeedbackContext);
}
