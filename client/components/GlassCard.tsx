import React from "react";
import { StyleSheet, Pressable, ViewStyle, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
  interpolateColor,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface GlassCardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  active?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
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
}: GlassCardProps) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      pressed.value,
      [0, 1],
      [
        active ? Colors.dark.primary : Colors.dark.glassBorder,
        Colors.dark.primary,
      ],
    ),
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, springConfig);
      pressed.value = withSpring(1, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
      pressed.value = withSpring(0, springConfig);
    }
  };

  const handlePress = () => {
    if (!disabled && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !onPress}
      testID={testID}
      style={[
        styles.card,
        animatedStyle,
        borderStyle,
        active && styles.cardActive,
        disabled && styles.cardDisabled,
        style,
      ]}
    >
      <View style={styles.cardBackground}>
        <LinearGradient
          colors={[
            active ? "rgba(17,164,212,0.15)" : "rgba(255,255,255,0.05)",
            active ? "rgba(17,164,212,0.05)" : "rgba(255,255,255,0.02)",
          ]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </View>
      <View style={styles.content}>
        {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
        <View style={styles.textContainer}>
          {title ? (
            <ThemedText type="h4" style={styles.title}>
              {title}
            </ThemedText>
          ) : null}
          {subtitle ? (
            <ThemedText
              type="small"
              style={{ color: Colors.dark.textSecondary }}
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
    borderColor: Colors.dark.glassBorder,
    overflow: "hidden",
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  cardActive: {
    borderColor: Colors.dark.primary,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.glass,
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
