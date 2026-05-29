import React, { useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Shadows, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type AppModalSurfaceProps = {
  visible: boolean;
  children: React.ReactNode;
  onClose?: () => void;
  variant?: "center" | "sheet";
  dismissible?: boolean;
  scrollable?: boolean;
  showCloseButton?: boolean;
  accessibilityLabel?: string;
  contentStyle?: ViewStyle;
  footer?: React.ReactNode;
};

export function AppModalSurface({
  visible,
  children,
  onClose,
  variant = "center",
  dismissible = true,
  scrollable = true,
  showCloseButton = true,
  accessibilityLabel,
  contentStyle,
  footer,
}: AppModalSurfaceProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const entrance = useSharedValue(reduceMotion ? 1 : 0);
  const canDismiss = dismissible && Boolean(onClose);
  const isSheet = variant === "sheet";

  useEffect(() => {
    if (!visible) {
      entrance.value = reduceMotion ? 1 : 0;
      return;
    }

    entrance.value = reduceMotion
      ? 1
      : withSpring(1, { damping: 18, stiffness: 190 });
  }, [entrance, reduceMotion, visible]);

  const surfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      {
        translateY: isSheet
          ? (1 - entrance.value) * 34
          : (1 - entrance.value) * 10,
      },
      { scale: isSheet ? 1 : 0.975 + entrance.value * 0.025 },
    ],
  }));

  const handleClose = () => {
    if (canDismiss) {
      onClose?.();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.root}>
        <BlurView
          intensity={isDark ? 10 : 8}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View
          pointerEvents="box-none"
          style={[
            styles.positioner,
            isSheet && styles.sheetPositioner,
            {
              paddingTop: Math.max(insets.top, Spacing.lg),
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.surface,
              isSheet ? styles.sheetSurface : styles.centerSurface,
              surfaceAnimatedStyle,
              {
                backgroundColor: theme.backgroundElevated,
                borderColor: theme.glassBorderLight,
              },
              contentStyle,
            ]}
          >
            {showCloseButton && onClose ? (
              <View pointerEvents="box-none" style={styles.closeRow}>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  style={[
                    styles.closeButton,
                    { backgroundColor: theme.glass, borderColor: theme.glassBorder },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Close dialog"
                >
                  <Feather name="x" size={20} color={theme.text} />
                </Pressable>
              </View>
            ) : null}
            {scrollable ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator
              >
                {children}
              </ScrollView>
            ) : (
              <View style={styles.staticContent}>{children}</View>
            )}
            {footer ? (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: theme.glassBorder,
                    backgroundColor: theme.backgroundElevated,
                  },
                ]}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  positioner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  sheetPositioner: {
    justifyContent: "flex-end",
    paddingHorizontal: 0,
  },
  surface: {
    width: "100%",
    overflow: "hidden",
    borderWidth: 1,
    ...Shadows.card,
  },
  centerSurface: {
    maxWidth: 420,
    maxHeight: "88%",
    alignSelf: "center",
    borderRadius: BorderRadius.xl,
  },
  sheetSurface: {
    maxHeight: "88%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderBottomWidth: 0,
  },
  closeRow: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingTop: Spacing["2xl"],
  },
  staticContent: {
    padding: Spacing.xl,
    paddingTop: Spacing["2xl"],
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});
