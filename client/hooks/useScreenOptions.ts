import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import { Colors } from "@/constants/theme";

interface UseScreenOptionsParams {
  transparent?: boolean;
}

export function useScreenOptions({
  transparent = true,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  return {
    headerTitleAlign: "center",
    headerTransparent: transparent,
    headerBlurEffect: "dark",
    headerTintColor: Colors.dark.text,
    headerStyle: {
      backgroundColor: Platform.select({
        ios: undefined,
        android: Colors.dark.backgroundRoot,
        web: Colors.dark.backgroundRoot,
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
      backgroundColor: Colors.dark.backgroundRoot,
    },
    animation: "slide_from_right",
  };
}
