import React, { useEffect } from "react";
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
  withTiming,
  useReducedMotion,
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
  density?: "default" | "compact";
  titleNumberOfLines?: number;
  subtitleNumberOfLines?: number;
  accessibilityRole?: "button" | "link" | "none" | "image" | "header" | "summary";
  accessibilityLabel?: string;
  accessibilityHint?: string;
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
  density = "default",
  titleNumberOfLines,
  subtitleNumberOfLines,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
}: GlassCardProps) {
  const { theme, isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const hover = useSharedValue(0);
  const entrance = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    entrance.value = withTiming(1, { duration: 360 });
  }, [entrance, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateY: (1 - entrance.value) * 10 - hover.value * 2 },
      { scale: scale.value * (0.985 + entrance.value * 0.015) },
    ],
  }));

  const hoverOverlayStyle = useAnimatedStyle(() => ({
    opacity: hover.value,
  }));

  const activeBorderColor = active ? theme.primary : theme.glassBorder;
  const pressedBorderColor = theme.primaryLight;

  const borderStyle = useAnimatedStyle(
    () => ({
      borderColor: interpolateColor(
        pressed.value,
        [0, 1],
        [activeBorderColor, pressedBorderColor],
      ),
    }),
    [activeBorderColor, pressedBorderColor],
  );

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

  const handleHoverIn = () => {
    if (!disabled && onPress && Platform.OS === "web") {
      hover.value = withTiming(1, { duration: 180 });
    }
  };

  const handleHoverOut = () => {
    if (Platform.OS === "web") {
      hover.value = withTiming(0, { duration: 180 });
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
  const isCompact = density === "compact";
  const resolvedTitleLines = titleNumberOfLines ?? (isCompact ? 2 : 2);
  const resolvedSubtitleLines = subtitleNumberOfLines ?? (isCompact ? 1 : 2);

  const cardStyles = [
    styles.card,
    {
      backgroundColor: isDark ? "transparent" : theme.backgroundElevated,
      borderColor: active ? theme.primary : theme.glassBorder,
    },
    animatedStyle,
    isDark && borderStyle,
    disabled && styles.cardDisabled,
    (isElevated || onPress) &&
      (isDark ? Shadows.cardSubtle : styles.lightCardShadow),
    isGlow && active && Shadows.glowSmall,
    style,
  ];

  const renderBackground = () => {
    if (!isDark) {
      return (
        <View style={styles.cardBackground}>
          {active || isGlow ? (
            <View
              style={[
                styles.lightAccentWash,
                {
                  backgroundColor: active
                    ? "rgba(0,153,204,0.06)"
                    : "rgba(0,153,204,0.035)",
                },
              ]}
            />
          ) : null}
        </View>
      );
    }

    if (Platform.OS === "web" || isSubtle) {
      return (
        <View style={styles.cardBackground}>
          <LinearGradient
            colors={[
              isSubtle ? "rgba(255,255,255,0.02)" : "rgba(17,164,212,0.06)",
              "rgba(255,255,255,0.025)",
              "rgba(255,255,255,0.015)",
            ]}
            locations={[0, 0.58, 1]}
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
            active ? "rgba(17,164,212,0.24)" : "rgba(17,164,212,0.11)",
            active ? "rgba(17,164,212,0.08)" : "rgba(255,255,255,0.04)",
            "rgba(255,255,255,0.02)",
          ]}
          locations={[0, 0.62, 1]}
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
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      disabled={disabled || !onPress}
      testID={testID}
      style={cardStyles}
      accessibilityRole={accessibilityRole || (onPress ? "button" : undefined)}
      accessibilityLabel={
        accessibilityLabel || (title ? `${title}${subtitle ? `, ${subtitle}` : ""}` : undefined)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected: active }}
    >
      {renderBackground()}
      {isDark ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.hoverOverlay, hoverOverlayStyle]}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.08)", "rgba(17,164,212,0.06)"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>
      ) : null}
      <View style={[styles.content, isCompact && styles.contentCompact]}>
        {icon ? (
          <View
            style={[
              styles.iconContainer,
              isCompact && styles.iconContainerCompact,
              {
                backgroundColor: isDark
                  ? theme.glassMedium
                  : "rgba(17,164,212,0.09)",
              },
            ]}
          >
            {icon}
          </View>
        ) : null}
        <View style={styles.textContainer}>
          {title ? (
            <ThemedText
              type="h4"
              style={[styles.title, isCompact && styles.titleCompact]}
              numberOfLines={resolvedTitleLines}
            >
              {title}
            </ThemedText>
          ) : null}
          {subtitle ? (
            <ThemedText
              type="small"
              style={[
                styles.subtitle,
                isCompact && styles.subtitleCompact,
                { color: theme.textSecondary },
              ]}
              numberOfLines={resolvedSubtitleLines}
            >
              {subtitle}
            </ThemedText>
          ) : null}
          {children}
        </View>
        {rightElement ? (
          <View
            style={[
              styles.rightElement,
              isCompact && styles.rightElementCompact,
            ]}
          >
            {rightElement}
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  lightCardShadow: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  lightAccentWash: {
    ...StyleSheet.absoluteFillObject,
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.cardPadding,
  },
  contentCompact: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  iconContainerCompact: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  titleCompact: {
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 2,
  },
  subtitle: {
    minWidth: 0,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  rightElement: {
    marginLeft: Spacing.md,
    flexShrink: 0,
  },
  rightElementCompact: {
    marginLeft: Spacing.sm,
  },
});
