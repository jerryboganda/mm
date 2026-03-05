import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
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
  const resolvedColor = color ?? theme.primary;

  return (
    <View
      style={[styles.container, { borderColor: theme.glassBorder }, style]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
    >
      <LinearGradient
        colors={[theme.glass, "rgba(255,255,255,0.08)"]}
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
    </View>
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
