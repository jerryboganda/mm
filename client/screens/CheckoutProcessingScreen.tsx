import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing } from "@/constants/theme";

interface Props {
  message?: string;
}

export default function CheckoutProcessingScreen({
  message = "Processing your purchase...",
}: Props) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

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
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <BackgroundGradient>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Animated.View
          style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Feather name="loader" size={48} color={Colors.dark.primary} />
          </Animated.View>
        </Animated.View>

        <ThemedText type="h3" style={styles.title}>
          {message}
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          Please wait while we securely process your payment. Do not close the
          app.
        </ThemedText>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={[styles.stepIcon, styles.stepIconComplete]}>
              <Feather name="check" size={14} color="#fff" />
            </View>
            <ThemedText style={styles.stepText}>Verifying payment</ThemedText>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.step}>
            <View style={[styles.stepIcon, styles.stepIconActive]}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
            <ThemedText style={styles.stepText}>
              Processing subscription
            </ThemedText>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <Feather name="circle" size={14} color={Colors.dark.textMuted} />
            </View>
            <ThemedText style={[styles.stepText, styles.stepTextPending]}>
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
    backgroundColor: `${Colors.dark.primary}15`,
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
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.glass,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  stepIconComplete: {
    backgroundColor: Colors.dark.success,
  },
  stepIconActive: {
    backgroundColor: Colors.dark.primary,
  },
  stepText: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  stepTextPending: {
    color: Colors.dark.textMuted,
  },
  stepLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.dark.glass,
    marginLeft: 13,
  },
});
