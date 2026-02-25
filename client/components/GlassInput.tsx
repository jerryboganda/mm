import React, { useState, useRef } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  Pressable,
  TextInputProps,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useMobileContent } from "@/lib/mobile-content";

interface GlassInputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}

export function GlassInput({
  label,
  error,
  icon,
  rightIcon,
  onRightIconPress,
  value,
  onFocus,
  onBlur,
  secureTextEntry,
  placeholder,
  ...props
}: GlassInputProps) {
  const { resolveText } = useMobileContent();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const hasValue = !!(value && value.length > 0);
  const focusAnim = useSharedValue(hasValue ? 1 : 0);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(focusAnim.value, [0, 1], [0, -28]) },
      { scale: interpolate(focusAnim.value, [0, 1], [1, 0.85]) },
    ],
    opacity: interpolate(focusAnim.value, [0, 1], [0.5, 1]),
  }));

  const handleFocus = (e: any) => {
    setIsFocused(true);
    focusAnim.value = withSpring(1, { damping: 15, stiffness: 150 });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (!value) {
      focusAnim.value = withSpring(0, { damping: 15, stiffness: 150 });
    }
    onBlur?.(e);
  };

  // Only show placeholder when focused (label has animated up) and no value yet
  const resolvedPlaceholder =
    typeof placeholder === "string" ? resolveText(placeholder) : placeholder;
  const effectivePlaceholder =
    isFocused && !hasValue ? resolvedPlaceholder : undefined;
  const resolvedLabel = resolveText(label);

  const isPassword = secureTextEntry !== undefined;
  const actualSecureTextEntry = isPassword && !showPassword;

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error ? styles.inputContainerError : null,
        ]}
        onPress={() => inputRef.current?.focus()}
      >
        {icon ? (
          <View style={styles.leftIcon}>
            <Feather
              name={icon}
              size={20}
              color={
                isFocused ? Colors.dark.primary : Colors.dark.textSecondary
              }
            />
          </View>
        ) : null}
        <View style={styles.inputWrapper}>
          <Animated.View
            style={[styles.labelContainer, labelStyle]}
            pointerEvents="none"
          >
            <ThemedText
              style={[
                styles.label,
                isFocused && { color: Colors.dark.primary },
              ]}
            >
              {resolvedLabel}
            </ThemedText>
          </Animated.View>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={effectivePlaceholder}
            placeholderTextColor={Colors.dark.textMuted}
            selectionColor={Colors.dark.primary}
            secureTextEntry={actualSecureTextEntry}
            {...props}
          />
        </View>
        {isPassword ? (
          <Pressable
            style={styles.rightIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={Colors.dark.textSecondary}
            />
          </Pressable>
        ) : rightIcon ? (
          <Pressable style={styles.rightIcon} onPress={onRightIconPress}>
            <Feather name={rightIcon} size={20} color={Colors.dark.primary} />
          </Pressable>
        ) : null}
      </Pressable>
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
  },
  inputContainerFocused: {
    borderColor: "rgba(17,164,212,0.7)",
  },
  inputContainerError: {
    borderColor: Colors.dark.error,
  },
  leftIcon: {
    marginRight: Spacing.md,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: "center",
    height: "100%",
  },
  labelContainer: {
    position: "absolute",
    left: 0,
    top: 18,
  },
  label: {
    ...Typography.body,
    color: Colors.dark.textSecondary,
  },
  input: {
    ...Typography.body,
    color: Colors.dark.text,
    paddingTop: 0,
    paddingBottom: 0,
    height: "100%",
    includeFontPadding: false,
  },
  rightIcon: {
    marginLeft: Spacing.md,
    padding: Spacing.xs,
  },
  errorText: {
    ...Typography.small,
    color: Colors.dark.error,
    marginTop: Spacing.xs,
    marginLeft: Spacing.lg,
  },
});
