import React from "react";
import { StyleSheet, View, Image, ViewStyle } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Colors, Spacing } from "@/constants/theme";

interface EmptyStateProps {
  image: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  image,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Image source={image} style={styles.image} resizeMode="contain" />
      <ThemedText type="h3" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText style={styles.description}>{description}</ThemedText>
      {actionLabel && onAction ? (
        <PrimaryButton
          title={actionLabel}
          onPress={onAction}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  image: {
    width: 180,
    height: 180,
    marginBottom: Spacing["2xl"],
    opacity: 0.9,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing["2xl"],
  },
  button: {
    minWidth: 200,
  },
});
