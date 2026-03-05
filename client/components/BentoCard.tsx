import React from "react";
import { StyleSheet, Pressable, ViewStyle, View, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface BentoCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
  size?: "small" | "medium" | "large" | "wide";
  variant?: "default" | "accent" | "success" | "purple" | "warning";
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: 12,
  mass: 0.4,
  stiffness: 180,
  overshootClamping: false,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BentoCard({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  onPress,
  style,
  size = "medium",
  variant = "default",
  testID,
}: BentoCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.965, springConfig);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const handlePress = () => {
    if (onPress) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress();
    }
  };

  const getAccentColor = () => {
    switch (variant) {
      case "accent":
        return theme.primary;
      case "success":
        return theme.success;
      case "purple":
        return theme.purple;
      case "warning":
        return theme.warning;
      default:
        return theme.textMuted;
    }
  };

  const getGlowColor = () => {
    switch (variant) {
      case "accent":
        return "rgba(17,164,212,0.10)";
      case "success":
        return "rgba(34,197,94,0.10)";
      case "purple":
        return "rgba(168,85,247,0.10)";
      case "warning":
        return "rgba(234,179,8,0.10)";
      default:
        return "rgba(255,255,255,0.03)";
    }
  };

  const accentColor = iconColor || getAccentColor();
  const glowColor = getGlowColor();

  const isSmall = size === "small";
  const isLarge = size === "large";
  const isWide = size === "wide";

  const renderBackground = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.background}>
          <LinearGradient
            colors={[glowColor, "rgba(255,255,255,0.02)"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      );
    }

    return (
      <BlurView intensity={18} tint={isDark ? "dark" : "light"} style={styles.background}>
        <LinearGradient
          colors={[glowColor, "rgba(255,255,255,0.03)"]}
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
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? "button" : "summary"}
      accessibilityLabel={`${title}: ${value}${subtitle ? `, ${subtitle}` : ""}`}
      style={[
        styles.card,
        { borderColor: theme.glassBorder },
        animatedStyle,
        isSmall && styles.cardSmall,
        isLarge && styles.cardLarge,
        isWide && styles.cardWide,
        variant !== "default" && Shadows.cardSubtle,
        style,
      ]}
    >
      {renderBackground()}
      <View style={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.header}>
          {icon ? (
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${accentColor}15` },
              ]}
            >
              <Feather
                name={icon}
                size={isSmall ? 18 : 22}
                color={accentColor}
              />
            </View>
          ) : null}
          <ThemedText
            type="label"
            style={[styles.title, { color: theme.textSecondary }, isSmall && styles.titleSmall]}
            numberOfLines={1}
          >
            {title}
          </ThemedText>
        </View>
        <View style={styles.valueContainer}>
          <ThemedText
            type="stat"
            style={[
              styles.value,
              isSmall && styles.valueSmall,
              isLarge && styles.valueLarge,
              { color: variant !== "default" ? accentColor : theme.text },
            ]}
            numberOfLines={1}
          >
            {value}
          </ThemedText>
          {subtitle ? (
            <ThemedText
              type="caption"
              style={[styles.subtitle, { color: theme.textMuted }]}
              numberOfLines={1}
            >
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 120,
  },
  cardSmall: {
    minHeight: 100,
  },
  cardLarge: {
    minHeight: 150,
  },
  cardWide: {
    minHeight: 100,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    padding: Spacing.cardPadding,
    justifyContent: "space-between",
  },
  contentWide: {
    flexDirection: "row",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
  },
  titleSmall: {
    fontSize: 10,
  },
  valueContainer: {
    marginTop: Spacing.md,
  },
  value: {
  },
  valueSmall: {
    fontSize: 26,
    lineHeight: 32,
  },
  valueLarge: {
    fontSize: 40,
    lineHeight: 48,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
});
