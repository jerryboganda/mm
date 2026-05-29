import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
  style?: ViewStyle;
}

export function StatCard({
  label,
  value,
  icon,
  color,
  style,
}: StatCardProps) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const entrance = useSharedValue(reduceMotion ? 1 : 0);
  const resolvedColor = color ?? theme.primary;

  useEffect(() => {
    if (reduceMotion) return;
    entrance.value = withTiming(1, { duration: 340 });
  }, [entrance, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateY: (1 - entrance.value) * 8 },
      { scale: 0.985 + entrance.value * 0.015 },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        { borderColor: theme.glassBorder },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
    >
      <LinearGradient
        colors={[
          `${resolvedColor}18`,
          theme.glass,
          "rgba(255,255,255,0.06)",
        ]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.iconContainer, { backgroundColor: `${resolvedColor}20` }]}>
        <Feather name={icon} size={20} color={resolvedColor} />
      </View>
      <ThemedText
        type="h2"
        style={[styles.value, { color: resolvedColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </ThemedText>
      <ThemedText style={[styles.label, { color: theme.textSecondary }]} numberOfLines={2}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: "center",
    overflow: "hidden",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  value: {
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: 12,
    textAlign: "center",
  },
});
