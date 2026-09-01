import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  message?: string;
}

export default function CheckoutProcessingScreen({
  message = "Processing your purchase...",
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [rotateAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    pulse.start();
    rotate.start();

    return () => {
      pulse.stop();
      rotate.stop();
    };
  }, [pulseAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <BackgroundGradient>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `${theme.primary}15`,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Feather name="loader" size={48} color={theme.primary} />
          </Animated.View>
        </Animated.View>

        <ThemedText type="h3" style={styles.title}>
          {message}
        </ThemedText>

        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Please wait while we securely process your payment. Do not close the
          app.
        </ThemedText>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View
              style={[
                styles.stepIcon,
                styles.stepIconComplete,
                { backgroundColor: theme.success },
              ]}
            >
              <Feather name="check" size={14} color="#fff" />
            </View>
            <ThemedText style={[styles.stepText, { color: theme.text }]}>
              Verifying payment
            </ThemedText>
          </View>
          <View style={[styles.stepLine, { backgroundColor: theme.glass }]} />
          <View style={styles.step}>
            <View
              style={[
                styles.stepIcon,
                styles.stepIconActive,
                { backgroundColor: theme.primary },
              ]}
            >
              <ActivityIndicator size="small" color="#fff" />
            </View>
            <ThemedText style={[styles.stepText, { color: theme.text }]}>
              Processing subscription
            </ThemedText>
          </View>
          <View style={[styles.stepLine, { backgroundColor: theme.glass }]} />
          <View style={styles.step}>
            <View style={[styles.stepIcon, { backgroundColor: theme.glass }]}>
              <Feather name="circle" size={14} color={theme.textMuted} />
            </View>
            <ThemedText style={[styles.stepText, { color: theme.textMuted }]}>
              Activating premium
            </ThemedText>
          </View>
        </View>
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing["3xl"],
    lineHeight: 22,
  },
  stepsContainer: {
    width: "100%",
    paddingHorizontal: Spacing.lg,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  stepIconComplete: {},
  stepIconActive: {},
  stepText: {
    fontSize: 14,
  },
  stepTextPending: {},
  stepLine: {
    width: 2,
    height: 20,
    marginLeft: 13,
  },
});
