import React from "react";
import {
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
  View,
  Platform,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
  interpolateColor,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "@/lib/haptics-wrapper";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface GlassCardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  testID?: string;
  variant?: "default" | "elevated" | "subtle" | "glow";
  blurIntensity?: number;
}

const springConfig: WithSpringConfig = {
  damping: 12,
  mass: 0.4,
  stiffness: 180,
  overshootClamping: false,
};

const springConfigBounce: WithSpringConfig = {
  damping: 10,
  mass: 0.4,
  stiffness: 180,
  overshootClamping: false,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassCard({
  title,
  subtitle,
  children,
  onPress,
  style,
  active = false,
  disabled = false,
  icon,
  rightElement,
  testID,
  variant = "default",
  blurIntensity = 20,
}: GlassCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const activeBorderColor = active ? theme.primary : theme.glassBorder;
  const pressedBorderColor = theme.primaryLight;

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      pressed.value,
      [0, 1],
      [
        activeBorderColor,
        pressedBorderColor,
      ],
    ),
  }), [activeBorderColor, pressedBorderColor]);

  const handlePressIn = () => {
    if (!disabled && onPress) {
      scale.value = withSpring(0.965, springConfig);
      pressed.value = withSpring(1, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfigBounce);
      pressed.value = withSpring(0, springConfig);
    }
  };

  const handlePress = () => {
    if (!disabled && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const isElevated = variant === "elevated" || variant === "glow";
  const isGlow = variant === "glow";
  const isSubtle = variant === "subtle";

  const cardStyles = [
    styles.card,
    animatedStyle,
    borderStyle,
    disabled && styles.cardDisabled,
    isElevated && Shadows.cardSubtle,
    isGlow && active && Shadows.glowSmall,
    style,
  ];

  const renderBackground = () => {
    if (Platform.OS === "web" || isSubtle) {
      return (
        <View style={styles.cardBackground}>
          <LinearGradient
            colors={[
              active
                ? "rgba(17,164,212,0.10)"
                : isSubtle
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(255,255,255,0.03)",
              active ? "rgba(17,164,212,0.03)" : "rgba(255,255,255,0.01)",
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      );
    }

    return (
      <BlurView
        intensity={active ? blurIntensity + 10 : blurIntensity}
        tint={isDark ? "dark" : "light"}
        style={styles.cardBackground}
      >
        <LinearGradient
          colors={[
            active ? "rgba(17,164,212,0.20)" : "rgba(255,255,255,0.08)",
            active ? "rgba(17,164,212,0.08)" : "rgba(255,255,255,0.03)",
          ]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </BlurView>
    );
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !onPress}
      testID={testID}
      style={cardStyles}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        title ? `${title}${subtitle ? `, ${subtitle}` : ""}` : undefined
      }
      accessibilityState={{ disabled, selected: active }}
    >
      {renderBackground()}
      <View style={styles.content}>
        {icon ? <View style={[styles.iconContainer, { backgroundColor: theme.glassMedium }]}>{icon}</View> : null}
        <View style={styles.textContainer}>
          {title ? (
            <ThemedText type="h4" style={styles.title} numberOfLines={2}>
              {title}
            </ThemedText>
          ) : null}
          {subtitle ? (
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
              numberOfLines={2}
            >
              {subtitle}
            </ThemedText>
          ) : null}
          {children}
        </View>
        {rightElement ? (
          <View style={styles.rightElement}>{rightElement}</View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.cardPadding,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  rightElement: {
    marginLeft: Spacing.md,
  },
});
