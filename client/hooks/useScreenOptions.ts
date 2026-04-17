import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import { useTheme } from "@/hooks/useTheme";

/**
 * Configuration options for {@link useScreenOptions}.
 */
interface UseScreenOptionsParams {
  transparent?: boolean;
}

/**
 * React hook that returns consistent NativeStack navigation options
 * adapted to the current theme and platform.
 * Provides transparent headers with blur on iOS and solid backgrounds on Android/web.
 *
 * @param options - Optional configuration. Pass `transparent: false` to disable header transparency.
 * @returns A `NativeStackNavigationOptions` object ready for use in screen configuration
 */
export function useScreenOptions({
  transparent = true,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();

  return {
    headerTitleAlign: "center",
    headerTransparent: transparent,
    headerBlurEffect: isDark ? "dark" : "light",
    headerTintColor: theme.text,
    headerStyle: {
      backgroundColor: Platform.select({
        ios: undefined,
        android: theme.backgroundRoot,
        web: theme.backgroundRoot,
      }),
    },
    headerTitleStyle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 17,
    },
    gestureEnabled: true,
    gestureDirection: "horizontal",
    fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
    animation: "slide_from_right",
  };
}
