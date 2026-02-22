import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useTheme } from "@/hooks/useTheme";

export default function DisclaimerScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { theme, isDark } = useTheme();

  // When shown during onboarding (headerShown: false), show continue button
  const isOnboarding = !(route.params as any)?.fromSettings;

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[theme.warning, "#f59e0b"]}
            style={styles.iconGradient}
          >
            <Feather name="alert-triangle" size={40} color="#fff" />
          </LinearGradient>
        </View>

        <ThemedText type="h2" style={styles.title}>
          Medical Disclaimer
        </ThemedText>

        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Please read this disclaimer carefully before using Maternal Mind
        </ThemedText>

        <GlassCard style={styles.card}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="book-open" size={20} color={theme.primary} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Educational Purpose Only
              </ThemedText>
            </View>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              Maternal Mind is designed exclusively for educational purposes.
              The content provided within this application is intended to
              supplement medical education for students studying obstetrics and
              gynecology.
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.glassBorder }]} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="x-circle" size={20} color={theme.error} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Not Medical Advice
              </ThemedText>
            </View>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              The information in this application does not constitute medical
              advice, diagnosis, or treatment recommendations. This content
              should never be used as a substitute for professional medical
              judgment.
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.glassBorder }]} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather
                name="user-check"
                size={20}
                color={theme.success}
              />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Consult Healthcare Providers
              </ThemedText>
            </View>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              Always consult qualified healthcare professionals for medical
              concerns. Clinical decisions should be based on individual patient
              assessment and current clinical guidelines.
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.glassBorder }]} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="refresh-cw" size={20} color={theme.info} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Content Updates
              </ThemedText>
            </View>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              Medical knowledge evolves continuously. While we strive to keep
              content current, some information may not reflect the latest
              research or guidelines. Always verify with up-to-date sources.
            </ThemedText>
          </View>
        </GlassCard>

        <GlassCard style={[styles.warningCard, {
          backgroundColor: isDark ? "rgba(234, 179, 8, 0.1)" : "rgba(234, 179, 8, 0.08)",
          borderColor: isDark ? "rgba(234, 179, 8, 0.3)" : "rgba(234, 179, 8, 0.2)"
        }]}>
          <View style={styles.warningContent}>
            <Feather
              name="alert-circle"
              size={24}
              color={theme.warning}
            />
            <ThemedText style={[styles.warningText, { color: theme.text }]}>
              By continuing to use Maternal Mind, you acknowledge that you have
              read and understood this disclaimer.
            </ThemedText>
          </View>
        </GlassCard>

        {isOnboarding && (
          <PrimaryButton
            title="I Understand & Continue"
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [{ name: "Register" }],
              });
            }}
            style={styles.continueButton}
          />
        )}
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: "100%",
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    paddingLeft: Spacing.xl + Spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  warningCard: {
    borderWidth: 1,
  },
  warningContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  continueButton: {
    width: "100%",
    marginTop: Spacing.md,
  },
});
