import React, { useEffect } from "react";
import { ViewStyle, StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  Easing,
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  SlideInDown,
  SlideInUp,
} from "react-native-reanimated";

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  type?: "fade" | "slide" | "scale" | "combined";
}

const BASE_DELAY = 50;

export function AnimatedListItem({
  children,
  index,
  style,
  delay = BASE_DELAY,
  direction = "up",
  type = "combined",
}: AnimatedListItemProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(direction === "down" ? -20 : 20);
  const translateX = useSharedValue(
    direction === "left" ? 20 : direction === "right" ? -20 : 0,
  );
  const scale = useSharedValue(0.95);

  useEffect(() => {
    const itemDelay = index * delay;

    opacity.value = withDelay(
      itemDelay,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
    );

    if (type === "combined" || type === "fade") {
      translateY.value = withDelay(
        itemDelay,
        withSpring(0, { damping: 14, stiffness: 120 }),
      );
    }

    if (type === "combined" || type === "scale") {
      scale.value = withDelay(
        itemDelay,
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
    }

    if (direction === "left" || direction === "right") {
      translateX.value = withDelay(
        itemDelay,
        withSpring(0, { damping: 14, stiffness: 120 }),
      );
    }
  }, [index, delay, direction, type]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
  );
}

export const ListAnimations = {
  FadeInDown: (delay: number) =>
    FadeInDown.delay(delay).springify().damping(14).stiffness(120),
  FadeInUp: (delay: number) =>
    FadeInUp.delay(delay).springify().damping(14).stiffness(120),
  FadeInLeft: (delay: number) =>
    FadeInLeft.delay(delay).springify().damping(14).stiffness(120),
  FadeInRight: (delay: number) =>
    FadeInRight.delay(delay).springify().damping(14).stiffness(120),
  SlideInDown: (delay: number) =>
    SlideInDown.delay(delay).springify().damping(14).stiffness(120),
  SlideInUp: (delay: number) =>
    SlideInUp.delay(delay).springify().damping(14).stiffness(120),
};

export function getStaggerDelay(index: number, baseDelay: number = 50): number {
  return index * baseDelay;
}
