import React, { useEffect, useState } from "react";
import { StyleSheet, View, Animated, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface OfflineBannerProps {
  isOffline: boolean;
  /** Number of queries served from cache */
  cachedQueryCount?: number;
  /** Called when user taps the retry / refresh button */
  onRetry?: () => void;
}

export function OfflineBanner({
  isOffline,
  cachedQueryCount,
  onRetry,
}: OfflineBannerProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [slideAnim] = useState(() => new Animated.Value(isOffline ? 0 : -80));

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOffline ? 0 : -80,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.warning ?? "#F59E0B",
          paddingTop: insets.top + 4,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Feather name="wifi-off" size={14} color="#fff" />
        <View style={styles.textCol}>
          <ThemedText style={styles.text}>
            You&apos;re offline — showing cached content
          </ThemedText>
          {cachedQueryCount !== undefined && cachedQueryCount > 0 && (
            <ThemedText style={styles.subtext}>
              {cachedQueryCount} pages available offline
            </ThemedText>
          )}
        </View>
        {onRetry && (
          <Pressable onPress={onRetry} hitSlop={12} style={styles.retryButton}>
            <Feather name="refresh-cw" size={14} color="#fff" />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: 8,
  },
  textCol: {
    flex: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  subtext: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    marginTop: 1,
  },
  retryButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
