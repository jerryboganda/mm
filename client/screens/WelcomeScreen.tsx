import React from "react";
import { StyleSheet, View, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type WelcomeScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={[
          theme.backgroundRoot,
          isDark ? theme.backgroundDefault : theme.backgroundTertiary,
          theme.backgroundRoot,
        ]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View
        style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}
      >
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
            Master OB-GYN with confidence
          </ThemedText>
        </View>

        <View style={[styles.featureList, { gap: Spacing.lg }]}>
          <View
            style={[
              styles.featureItem,
              {
                backgroundColor: theme.glassMedium,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: `${theme.primary}26` },
              ]}
            >
              <ThemedText style={styles.featureEmoji}>{"📚"}</ThemedText>
            </View>
            <View style={styles.featureText}>
              <ThemedText type="body" style={styles.featureTitle}>
                Comprehensive Content
              </ThemedText>
              <ThemedText
                style={[styles.featureDesc, { color: theme.textSecondary }]}
              >
                Learn from structured textbook chapters
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.featureItem,
              {
                backgroundColor: theme.glassMedium,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: `${theme.primary}26` },
              ]}
            >
              <ThemedText style={styles.featureEmoji}>{"🎯"}</ThemedText>
            </View>
            <View style={styles.featureText}>
              <ThemedText type="body" style={styles.featureTitle}>
                Practice Quizzes
              </ThemedText>
              <ThemedText
                style={[styles.featureDesc, { color: theme.textSecondary }]}
              >
                Test your knowledge with MCQs
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.featureItem,
              {
                backgroundColor: theme.glassMedium,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: `${theme.primary}26` },
              ]}
            >
              <ThemedText style={styles.featureEmoji}>{"📊"}</ThemedText>
            </View>
            <View style={styles.featureText}>
              <ThemedText type="body" style={styles.featureTitle}>
                Track Progress
              </ThemedText>
              <ThemedText
                style={[styles.featureDesc, { color: theme.textSecondary }]}
              >
                Monitor your learning journey
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.buttonSection,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <PrimaryButton
          title="Get Started"
          onPress={() => navigation.navigate("Onboarding")}
          style={styles.primaryButton}
          testID="button-get-started"
        />
        <PrimaryButton
          title="I already have an account"
          onPress={() => navigation.navigate("Login")}
          variant="ghost"
          style={styles.secondaryButton}
          testID="button-have-account"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 160,
    height: 160,
    borderRadius: 32,
    marginBottom: Spacing.lg,
  },
  tagline: {
    fontSize: 16,
    textAlign: "center",
  },
  featureList: {
    gap: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: "600",
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
  },
  buttonSection: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    width: "100%",
  },
});
