import React from "react";
import { StyleSheet, Pressable, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@/lib/haptics-wrapper";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface OptionButtonProps {
  label: string;
  text: string;
  onPress: () => void;
  selected?: boolean;
  correct?: boolean;
  incorrect?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function OptionButton({
  label,
  text,
  onPress,
  selected = false,
  correct,
  incorrect,
  disabled = false,
  style,
  testID,
}: OptionButtonProps) {
  const scale = useSharedValue(1);
  const { theme } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const getBorderColor = () => {
    if (correct) return theme.success;
    if (incorrect) return theme.error;
    if (selected) return theme.primary;
    return theme.glassBorder;
  };

  const getBackgroundColor = () => {
    if (correct) return "rgba(34,197,94,0.1)";
    if (incorrect) return "rgba(239,68,68,0.1)";
    if (selected) return "rgba(17,164,212,0.1)";
    return theme.glass;
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Option ${label}: ${text}`}
      accessibilityState={{
        disabled,
        selected: selected,
        ...(correct !== undefined && { checked: correct }),
      }}
      style={[
        styles.container,
        animatedStyle,
        {
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.labelContainer,
          {
            backgroundColor: selected
              ? theme.primary
              : "rgba(255,255,255,0.08)",
          },
        ]}
      >
        <ThemedText
          style={[
            styles.label,
            { color: theme.text },
            selected && { color: "#fff" },
          ]}
        >
          {label}
        </ThemedText>
      </View>
      <ThemedText style={[styles.text, { color: theme.text }]} numberOfLines={4}>
        {text}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    minHeight: 56,
  },
  disabled: {
    opacity: 0.6,
  },
  labelContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  text: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});
