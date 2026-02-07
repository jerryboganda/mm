import React from "react";
import {
  StyleSheet,
  Pressable,
  ViewStyle,
  ActivityIndicator,
  Platform,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
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
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  size?: "default" | "large" | "small";
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: 12,
  mass: 0.3,
  stiffness: 200,
  overshootClamping: false,
};

const springConfigBounce: WithSpringConfig = {
  damping: 10,
  mass: 0.3,
  stiffness: 200,
  overshootClamping: false,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = "right",
  style,
  variant = "primary",
  size = "default",
  testID,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);
  const brightness = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: brightness.value,
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.955, springConfig);
      brightness.value = withSpring(0.9, springConfig);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfigBounce);
    brightness.value = withSpring(1, springConfig);
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onPress();
    }
  };

  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const isSuccess = variant === "success";
  const isDanger = variant === "danger";
  const isSecondary = variant === "secondary";

  const isSmall = size === "small";
  const isLarge = size === "large";

  const getGradientColors = (): [string, string] => {
    if (isSuccess) return [Colors.dark.success, "#16a34a"];
    if (isDanger) return [Colors.dark.error, "#dc2626"];
    return [Colors.dark.primary, Colors.dark.primaryDark];
  };

  const getShadowStyle = () => {
    if (disabled || loading) return {};
    if (isSuccess) return Shadows.glowSuccess;
    if (isDanger) return Shadows.glowError;
    if (isPrimary) return Shadows.glow;
    return {};
  };

  const iconSize = isSmall ? 16 : isLarge ? 24 : 20;
  const iconColor =
    isPrimary || isSuccess || isDanger ? "#fff" : Colors.dark.primary;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.button,
        animatedStyle,
        isSmall && styles.buttonSmall,
        isLarge && styles.buttonLarge,
        (isPrimary || isSuccess || isDanger) && getShadowStyle(),
        isSecondary && styles.secondaryButton,
        isGhost && styles.ghostButton,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {isPrimary || isSuccess || isDanger ? (
        <LinearGradient
          colors={getGradientColors()}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator
          color={
            isPrimary || isSuccess || isDanger ? "#fff" : Colors.dark.primary
          }
          size={isSmall ? "small" : "small"}
        />
      ) : (
        <>
          {icon && iconPosition === "left" ? (
            <Feather
              name={icon}
              size={iconSize}
              color={iconColor}
              style={styles.iconLeft}
            />
          ) : null}
          <ThemedText
            style={[
              styles.buttonText,
              isSmall && styles.buttonTextSmall,
              isLarge && styles.buttonTextLarge,
              (isPrimary || isSuccess || isDanger) && styles.primaryText,
              isSecondary && styles.secondaryText,
              isGhost && styles.ghostText,
            ]}
          >
            {title}
          </ThemedText>
          {icon && iconPosition === "right" ? (
            <Feather
              name={icon}
              size={iconSize}
              color={iconColor}
              style={styles.iconRight}
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
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: Spacing.xl,
  },
  buttonSmall: {
    height: 42,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  buttonLarge: {
    height: 64,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.xl,
  },
  secondaryButton: {
    backgroundColor: Colors.dark.glassMedium,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorderLight,
  },
  ghostButton: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  buttonTextSmall: {
    fontSize: 14,
  },
  buttonTextLarge: {
    fontSize: 18,
    fontWeight: "700",
  },
  primaryText: {
    color: "#fff",
  },
  secondaryText: {
    color: Colors.dark.text,
  },
  ghostText: {
    color: Colors.dark.primary,
  },
  iconLeft: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginLeft: Spacing.sm,
  },
});
