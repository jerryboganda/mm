import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, BorderRadius } from "@/constants/theme";

interface ProgressBarProps {
  progress: number;
  height?: number;
  style?: ViewStyle;
  showGlow?: boolean;
}

export function ProgressBar({
  progress,
  height = 8,
  style,
  showGlow = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(`${clampedProgress}%` as any, {
      damping: 15,
      stiffness: 100,
    }),
  }));

  return (
    <View style={[styles.container, { height }, style]}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View
          style={[
            styles.fill,
            { height, borderRadius: height / 2 },
            showGlow && styles.glow,
            animatedStyle,
          ]}
        >
          <LinearGradient
            colors={[Colors.dark.primary, Colors.dark.primaryDark]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  track: {
    backgroundColor: Colors.dark.glass,
    overflow: "hidden",
  },
  fill: {
    overflow: "hidden",
  },
  glow: {
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
});
