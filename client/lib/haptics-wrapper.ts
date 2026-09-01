/**
 * Haptics Wrapper — drop-in replacement for `expo-haptics`
 *
 * Re-exports the same types and functions as `expo-haptics`, but every call
 * checks the global haptic preference before firing.
 *
 * Usage: replace `import * as Haptics from "expo-haptics"` with
 *        `import * as Haptics from "@/lib/haptics-wrapper"`
 *
 * No other code changes needed — all call sites stay the same.
 */
import * as RealHaptics from "expo-haptics";
import { Platform } from "react-native";
import { getHapticEnabled } from "./feedback";

// Re-export all types so call sites still compile
export { ImpactFeedbackStyle, NotificationFeedbackType } from "expo-haptics";

export async function impactAsync(
  style: RealHaptics.ImpactFeedbackStyle = RealHaptics.ImpactFeedbackStyle
    .Medium,
): Promise<void> {
  if (!getHapticEnabled() || Platform.OS === "web") return;
  return RealHaptics.impactAsync(style);
}

export async function notificationAsync(
  type: RealHaptics.NotificationFeedbackType = RealHaptics
    .NotificationFeedbackType.Success,
): Promise<void> {
  if (!getHapticEnabled() || Platform.OS === "web") return;
  return RealHaptics.notificationAsync(type);
}

export async function selectionAsync(): Promise<void> {
  if (!getHapticEnabled() || Platform.OS === "web") return;
  return RealHaptics.selectionAsync();
}
