import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type PurchaseSuccessScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const unlockFeatures = [
  { icon: "book-open" as const, text: "All textbook content unlocked" },
  { icon: "check-circle" as const, text: "Unlimited MCQ practice" },
  { icon: "trending-up" as const, text: "Advanced progress analytics" },
  { icon: "bookmark" as const, text: "Bookmarks & notes enabled" },
];

export default function PurchaseSuccessScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PurchaseSuccessScreenNavigationProp>();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };

  return (
    <BackgroundGradient>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
      >
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={[Colors.dark.success, "#16a34a"]}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Feather name="check" size={48} color="#fff" />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <ThemedText type="h1" style={styles.title}>
            Welcome to Premium!
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Your subscription is now active. Enjoy unlimited access to all Maternal Mind features.
          </ThemedText>
        </Animated.View>

        <Animated.View style={[styles.featuresSection, { opacity: fadeAnim }]}>
          <ThemedText style={styles.sectionLabel}>NOW UNLOCKED</ThemedText>
          <GlassCard style={styles.featuresCard}>
            {unlockFeatures.map((feature, index) => (
              <View
                key={index}
                style={[
                  styles.featureRow,
                  index < unlockFeatures.length - 1 && styles.featureRowBorder,
                ]}
              >
                <View style={styles.featureIcon}>
                  <Feather name={feature.icon} size={18} color={Colors.dark.success} />
                </View>
                <ThemedText style={styles.featureText}>{feature.text}</ThemedText>
                <Feather name="check" size={18} color={Colors.dark.success} />
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        <Animated.View style={[styles.ctaSection, { opacity: fadeAnim }]}>
          <PrimaryButton
            title="Start Learning"
            onPress={handleContinue}
            icon="arrow-right"
            style={styles.ctaButton}
            testID="button-start-learning"
          />
        </Animated.View>
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    alignSelf: "center",
    marginBottom: Spacing["2xl"],
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  featuresSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.lg,
  },
  featuresCard: {
    padding: 0,
    overflow: "hidden",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  featureRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.glass,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.dark.success}15`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
  },
  ctaSection: {
    marginTop: Spacing.xl,
  },
  ctaButton: {},
});
