import { useColorScheme } from "react-native";
import { useCallback, useSyncExternalStore } from "react";
import { Colors } from "@/constants/theme";

// Simple in-memory store for theme override (null = follow system)
type ThemeMode = "light" | "dark" | "system";
let themeOverride: ThemeMode = "system";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return themeOverride;
}

export function setThemeMode(mode: ThemeMode) {
  themeOverride = mode;
  listeners.forEach((cb) => cb());
}

export function getThemeMode(): ThemeMode {
  return themeOverride;
}

export function useTheme() {
  const systemScheme = useColorScheme();
  const override = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const resolvedScheme =
    override === "system" ? (systemScheme ?? "dark") : override;
  const isDark = resolvedScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? "light" : "dark");
  }, [isDark]);

  return {
    theme,
    isDark,
    themeMode: override,
    setThemeMode,
    toggleTheme,
  };
}
