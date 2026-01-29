import React from "react";
import { StyleSheet, View, Image, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Colors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width, height } = Dimensions.get("window");

type WelcomeScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<WelcomeScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          Colors.dark.backgroundRoot,
          "#0a1518",
          Colors.dark.backgroundRoot,
        ]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View
        style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}
      >
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <ThemedText type="h1" style={styles.title}>
            Maternal Mind
          </ThemedText>
          <ThemedText style={styles.tagline}>
            Master OB-GYN with confidence
          </ThemedText>
        </View>

        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <ThemedText style={styles.featureEmoji}>{"📚"}</ThemedText>
            </View>
            <View style={styles.featureText}>
              <ThemedText type="body" style={styles.featureTitle}>
                Comprehensive Content
              </ThemedText>
              <ThemedText style={styles.featureDesc}>
                Learn from structured textbook chapters
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <ThemedText style={styles.featureEmoji}>{"🎯"}</ThemedText>
            </View>
            <View style={styles.featureText}>
              <ThemedText type="body" style={styles.featureTitle}>
                Practice Quizzes
              </ThemedText>
              <ThemedText style={styles.featureDesc}>
                Test your knowledge with MCQs
              </ThemedText>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <ThemedText style={styles.featureEmoji}>{"📊"}</ThemedText>
            </View>
            <View style={styles.featureText}>
              <ThemedText type="body" style={styles.featureTitle}>
                Track Progress
              </ThemedText>
              <ThemedText style={styles.featureDesc}>
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
    backgroundColor: Colors.dark.backgroundRoot,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: "rgba(17,164,212,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: "rgba(17,164,212,0.3)",
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 32,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  featureList: {
    gap: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(17,164,212,0.08)",
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(17,164,212,0.15)",
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(17,164,212,0.15)",
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
    color: Colors.dark.textSecondary,
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
