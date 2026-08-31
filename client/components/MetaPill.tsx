import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface MetaPillProps {
  label: string;
  tone?: "neutral" | "accent";
  maxWidth?: number;
}

export function MetaPill({
  label,
  tone = "neutral",
  maxWidth = 190,
}: MetaPillProps) {
  const { theme } = useTheme();
  if (!label) return null;
  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.pill,
        tone === "accent"
          ? { backgroundColor: `${theme.primary}1A` }
          : { backgroundColor: theme.glass },
      ]}
    >
      <ThemedText
        style={[
          styles.pillText,
          { color: tone === "accent" ? theme.primary : theme.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </View>
  );
}

interface MetaPillRowProps {
  year?: number | null;
  subjectName?: string | null;
  sourceName?: string | null;
  style?: object;
}

export function MetaPillRow({
  year,
  subjectName,
  sourceName,
  style,
}: MetaPillRowProps) {
  const hasAny = Boolean(year || subjectName || sourceName);
  if (!hasAny) return null;
  return (
    <View style={[styles.row, style]} accessibilityRole="summary">
      {year ? (
        <MetaPill label={String(year)} tone="accent" maxWidth={70} />
      ) : null}
      {subjectName ? <MetaPill label={subjectName} /> : null}
      {sourceName ? <MetaPill label={sourceName} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.xs,
  },
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    maxWidth: 190,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
