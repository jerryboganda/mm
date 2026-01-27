import React from "react";
import { StyleSheet, View, ViewStyle, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Colors } from "@/constants/theme";

interface BackgroundGradientProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "auth" | "quiz";
}

const { width, height } = Dimensions.get("window");

export function BackgroundGradient({
  children,
  style,
  variant = "default",
}: BackgroundGradientProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[Colors.dark.backgroundRoot, "#0a1418", Colors.dark.backgroundRoot]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.orbContainer}>
          <View style={[styles.orb, styles.orbTopRight]} />
          <View style={[styles.orb, styles.orbBottomLeft]} />
          {variant === "auth" ? (
            <View style={[styles.orb, styles.orbCenter]} />
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
    width: width * 0.8,
    height: width * 0.8,
    top: -width * 0.3,
    right: -width * 0.3,
    backgroundColor: "rgba(17,164,212,0.08)",
  },
  orbBottomLeft: {
    width: width * 0.6,
    height: width * 0.6,
    bottom: -width * 0.2,
    left: -width * 0.2,
    backgroundColor: "rgba(168,85,247,0.05)",
  },
  orbCenter: {
    width: width * 0.5,
    height: width * 0.5,
    top: height * 0.3,
    left: width * 0.25,
    backgroundColor: "rgba(17,164,212,0.05)",
  },
});
