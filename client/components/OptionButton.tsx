import React from "react";
import { StyleSheet, Pressable, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

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
    if (correct) return Colors.dark.success;
    if (incorrect) return Colors.dark.error;
    if (selected) return Colors.dark.primary;
    return Colors.dark.glassBorder;
  };

  const getBackgroundColor = () => {
    if (correct) return "rgba(34,197,94,0.1)";
    if (incorrect) return "rgba(239,68,68,0.1)";
    if (selected) return "rgba(17,164,212,0.1)";
    return Colors.dark.glass;
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      testID={testID}
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
            backgroundColor: selected ? Colors.dark.primary : Colors.dark.glass,
          },
        ]}
      >
        <ThemedText style={[styles.label, selected && { color: "#fff" }]}>
          {label}
        </ThemedText>
      </View>
      <ThemedText style={styles.text}>{text}</ThemedText>
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
    fontWeight: "600",
    color: Colors.dark.text,
  },
  text: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
});
