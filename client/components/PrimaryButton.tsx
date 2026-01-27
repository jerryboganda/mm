import React from "react";
import { StyleSheet, Pressable, ViewStyle, ActivityIndicator } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
  variant?: "primary" | "secondary" | "ghost";
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  style,
  variant = "primary",
  testID,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      testID={testID}
      style={[
        styles.button,
        animatedStyle,
        isPrimary && styles.primaryButton,
        isGhost && styles.ghostButton,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[Colors.dark.primary, Colors.dark.primaryDark]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#fff" : Colors.dark.primary} />
      ) : (
        <>
          <ThemedText
            style={[
              styles.buttonText,
              isPrimary && styles.primaryText,
              isGhost && styles.ghostText,
            ]}
          >
            {title}
          </ThemedText>
          {icon ? (
            <Feather
              name={icon}
              size={20}
              color={isPrimary ? "#fff" : Colors.dark.primary}
              style={styles.icon}
            />
          ) : null}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryButton: {
    ...Shadows.glow,
  },
  ghostButton: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryText: {
    color: "#fff",
  },
  ghostText: {
    color: Colors.dark.primary,
  },
  icon: {
    marginLeft: Spacing.sm,
  },
});
