import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function DisclaimerScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[Colors.dark.warning, "#f59e0b"]}
            style={styles.iconGradient}
          >
            <Feather name="alert-triangle" size={40} color="#fff" />
          </LinearGradient>
        </View>

        <ThemedText type="h2" style={styles.title}>
          Medical Disclaimer
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          Please read this disclaimer carefully before using Maternal Mind
        </ThemedText>

        <GlassCard style={styles.card}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="book-open" size={20} color={Colors.dark.primary} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Educational Purpose Only
              </ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              Maternal Mind is designed exclusively for educational purposes.
              The content provided within this application is intended to
              supplement medical education for students studying obstetrics and
              gynecology.
            </ThemedText>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="x-circle" size={20} color={Colors.dark.error} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Not Medical Advice
              </ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              The information in this application does not constitute medical
              advice, diagnosis, or treatment recommendations. This content
              should never be used as a substitute for professional medical
              judgment.
            </ThemedText>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather
                name="user-check"
                size={20}
                color={Colors.dark.success}
              />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Consult Healthcare Providers
              </ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              Always consult qualified healthcare professionals for medical
              concerns. Clinical decisions should be based on individual patient
              assessment and current clinical guidelines.
            </ThemedText>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="refresh-cw" size={20} color={Colors.dark.info} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Content Updates
              </ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              Medical knowledge evolves continuously. While we strive to keep
              content current, some information may not reflect the latest
              research or guidelines. Always verify with up-to-date sources.
            </ThemedText>
          </View>
        </GlassCard>

        <GlassCard style={[styles.card, styles.warningCard]}>
          <View style={styles.warningContent}>
            <Feather
              name="alert-circle"
              size={24}
              color={Colors.dark.warning}
            />
            <ThemedText style={styles.warningText}>
              By continuing to use Maternal Mind, you acknowledge that you have
              read and understood this disclaimer.
            </ThemedText>
          </View>
        </GlassCard>
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
    color: Colors.dark.textSecondary,
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
    color: Colors.dark.textSecondary,
    paddingLeft: Spacing.xl + Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.glassBorder,
    marginVertical: Spacing.lg,
  },
  warningCard: {
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    borderColor: "rgba(234, 179, 8, 0.3)",
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
    color: Colors.dark.text,
  },
});
