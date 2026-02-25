import React, { useEffect } from "react";
import {
  StyleSheet,
  View,
  ViewStyle,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { Colors } from "@/constants/theme";

interface BackgroundGradientProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "auth" | "quiz" | "immersive";
  animated?: boolean;
}

const { width, height } = Dimensions.get("window");

export function BackgroundGradient({
  children,
  style,
  variant = "default",
  animated = true,
}: BackgroundGradientProps) {
  const orbScale1 = useSharedValue(1);
  const orbScale2 = useSharedValue(1);
  const orbOpacity1 = useSharedValue(0.08);
  const orbOpacity2 = useSharedValue(0.05);
  const orbTranslateY1 = useSharedValue(0);
  const orbTranslateX2 = useSharedValue(0);

  useEffect(() => {
    if (animated && Platform.OS !== "web") {
      orbScale1.value = withRepeat(
        withSequence(
          withTiming(1.15, {
            duration: 8000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      orbScale2.value = withRepeat(
        withSequence(
          withTiming(1.2, {
            duration: 10000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      orbOpacity1.value = withRepeat(
        withSequence(
          withTiming(0.12, {
            duration: 6000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0.08, {
            duration: 6000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );

      orbOpacity2.value = withRepeat(
        withSequence(
          withTiming(0.08, {
            duration: 7000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0.04, {
            duration: 7000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );

      orbTranslateY1.value = withRepeat(
        withSequence(
          withTiming(20, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-20, {
            duration: 9000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );

      orbTranslateX2.value = withRepeat(
        withSequence(
          withTiming(15, {
            duration: 11000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(-15, {
            duration: 11000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
    }
  }, [animated]);

  const animatedOrb1Style = useAnimatedStyle(() => ({
    transform: [
      { scale: orbScale1.value },
      { translateY: orbTranslateY1.value },
    ],
    opacity: orbOpacity1.value,
  }));

  const animatedOrb2Style = useAnimatedStyle(() => ({
    transform: [
      { scale: orbScale2.value },
      { translateX: orbTranslateX2.value },
    ],
    opacity: orbOpacity2.value,
  }));

  const isImmersive = variant === "immersive";
  const isQuiz = variant === "quiz";

  return (
    <View style={[styles.container, style]}>
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[
            Colors.dark.backgroundRoot,
            isImmersive ? "#0a1519" : "#0d1519",
            isImmersive ? "#101d22" : Colors.dark.backgroundRoot,
          ]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.orbContainer}>
          {Platform.OS !== "web" && animated ? (
            <>
              <Animated.View
                style={[styles.orb, styles.orbTopRight, animatedOrb1Style]}
              />
              <Animated.View
                style={[styles.orb, styles.orbBottomLeft, animatedOrb2Style]}
              />
            </>
          ) : (
            <>
              <View style={[styles.orb, styles.orbTopRight]} />
              <View style={[styles.orb, styles.orbBottomLeft]} />
            </>
          )}
          {isQuiz ? <View style={[styles.orb, styles.orbQuiz]} /> : null}
          {isImmersive ? (
            <>
              <View style={[styles.orb, styles.orbAccent]} />
              <View style={[styles.orb, styles.orbPurple]} />
            </>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    borderRadius: 9999,
  },
  orbTopRight: {
    width: width * 0.9,
    height: width * 0.9,
    top: -width * 0.35,
    right: -width * 0.35,
    backgroundColor: "rgba(17,164,212,0.08)",
  },
  orbBottomLeft: {
    width: width * 0.7,
    height: width * 0.7,
    bottom: -width * 0.25,
    left: -width * 0.25,
    backgroundColor: "rgba(168,85,247,0.05)",
  },
  orbQuiz: {
    width: width * 0.6,
    height: width * 0.6,
    top: height * 0.15,
    right: -width * 0.2,
    backgroundColor: "rgba(34,197,94,0.04)",
  },
  orbAccent: {
    width: width * 0.4,
    height: width * 0.4,
    top: height * 0.5,
    right: width * 0.1,
    backgroundColor: "rgba(17,164,212,0.04)",
  },
  orbPurple: {
    width: width * 0.5,
    height: width * 0.5,
    bottom: height * 0.2,
    left: width * 0.3,
    backgroundColor: "rgba(168,85,247,0.03)",
  },
});
