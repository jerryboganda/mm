import { useColorScheme } from "react-native";
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/theme";

// Simple in-memory store for theme override (null = follow system)
export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "@theme_mode";

// Global state to sync across hooks
let currentMode: ThemeMode = "system";
const listeners = new Set<(mode: ThemeMode) => void>();

/**
 * Get the current theme mode without subscribing to changes.
 * @returns The current theme mode: "light", "dark", or "system"
 */
export function getThemeMode(): ThemeMode {
  return currentMode;
}

/**
 * Imperatively set the theme mode. Persists the choice to AsyncStorage
 * and notifies all active `useTheme` subscribers.
 * @param mode - The desired theme mode: "light", "dark", or "system"
 */
export function setThemeMode(mode: ThemeMode) {
  currentMode = mode;
  AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((err) =>
    console.warn("Failed to save theme preference:", err),
  );
  listeners.forEach((cb) => cb(mode));
}

// Initialize from storage (fire and forget)
AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
  if (saved && (saved === "light" || saved === "dark" || saved === "system")) {
    setThemeMode(saved as ThemeMode);
  }
});

/**
 * React hook that provides the resolved theme colors and controls for toggling theme mode.
 * Subscribes to global theme mode changes and resolves "system" to the device color scheme.
 *
 * @returns An object containing:
 *  - `theme` — The resolved color palette (light or dark)
 *  - `isDark` — Whether the resolved scheme is dark
 *  - `themeMode` — The raw mode setting ("light" | "dark" | "system")
 *  - `setThemeMode` — Function to change the mode
 *  - `toggleTheme` — Convenience function to flip between light and dark
 */
export function useTheme() {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(currentMode);

  useEffect(() => {
    const listener = (newMode: ThemeMode) => setMode(newMode);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const resolvedScheme = mode === "system" ? (systemScheme ?? "dark") : mode;

  const isDark = resolvedScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? "light" : "dark");
  }, [isDark]);

  return {
    theme,
    isDark,
    themeMode: mode,
    setThemeMode,
    toggleTheme,
  };
}
