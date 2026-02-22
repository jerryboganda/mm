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

export function getThemeMode(): ThemeMode {
  return currentMode;
}

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

  const resolvedScheme =
    mode === "system" ? systemScheme ?? "dark" : mode;

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
