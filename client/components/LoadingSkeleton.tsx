import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, BorderRadius, Spacing } from "@/constants/theme";

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function LoadingSkeleton({
  width = "100%",
  height = 20,
  borderRadius = BorderRadius.sm,
  style,
}: LoadingSkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmer.value, [0, 1], [-200, 200]),
      },
    ],
  }));

  return (
    <View
      style={[
        styles.container,
        { width: width as any, height, borderRadius },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, animatedStyle]}>
        <LinearGradient
          colors={[
            "transparent",
            "rgba(255,255,255,0.08)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <LoadingSkeleton width={48} height={48} borderRadius={BorderRadius.md} />
        <View style={styles.cardHeaderText}>
          <LoadingSkeleton width="70%" height={18} />
          <LoadingSkeleton width="50%" height={14} style={{ marginTop: 8 }} />
        </View>
      </View>
      <LoadingSkeleton width="100%" height={8} style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.glass,
    overflow: "hidden",
  },
  shimmer: {
    width: 200,
    height: "100%",
    position: "absolute",
  },
  gradient: {
    flex: 1,
  },
  cardContainer: {
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
