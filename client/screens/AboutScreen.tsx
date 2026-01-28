import React from "react";
import { StyleSheet, View, ScrollView, Linking, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const appVersion = Constants.expoConfig?.version || "1.0.0";
const buildNumber = Constants.expoConfig?.ios?.buildNumber || "1";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const handleOpenLink = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  };

  const legalItems = [
    {
      id: "terms",
      title: "Terms of Service",
      icon: "file-text" as const,
      url: "https://maternalmind.app/terms",
    },
    {
      id: "privacy",
      title: "Privacy Policy",
      icon: "shield" as const,
      url: "https://maternalmind.app/privacy",
    },
    {
      id: "licenses",
      title: "Open Source Licenses",
      icon: "code" as const,
      url: "https://maternalmind.app/licenses",
    },
  ];

  const acknowledgements = [
    "Medical content reviewed by board-certified OB-GYN physicians",
    "Powered by React Native and Expo",
    "Icons by Feather Icons",
    "Fonts by Google Fonts",
  ];

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="h2" style={styles.appName}>
            Maternal Mind
          </ThemedText>
          <ThemedText style={styles.tagline}>
            OB-GYN Education Made Simple
          </ThemedText>
        </View>

        <GlassCard style={styles.versionCard}>
          <View style={styles.versionRow}>
            <ThemedText style={styles.versionLabel}>Version</ThemedText>
            <ThemedText style={styles.versionValue}>{appVersion}</ThemedText>
          </View>
          <View style={styles.divider} />
          <View style={styles.versionRow}>
            <ThemedText style={styles.versionLabel}>Build</ThemedText>
            <ThemedText style={styles.versionValue}>{buildNumber}</ThemedText>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>LEGAL</ThemedText>
          {legalItems.map((item) => (
            <GlassCard
              key={item.id}
              style={styles.legalCard}
              onPress={() => handleOpenLink(item.url)}
            >
              <View style={styles.legalRow}>
                <View style={styles.legalIcon}>
                  <Feather name={item.icon} size={18} color={Colors.dark.primary} />
                </View>
                <ThemedText style={styles.legalTitle}>{item.title}</ThemedText>
                <Feather name="external-link" size={16} color={Colors.dark.textSecondary} />
              </View>
            </GlassCard>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>ACKNOWLEDGEMENTS</ThemedText>
          <GlassCard style={styles.acknowledgementsCard}>
            {acknowledgements.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.acknowledgementRow,
                  index < acknowledgements.length - 1 && styles.acknowledgementRowBorder,
                ]}
              >
                <Feather name="check" size={14} color={Colors.dark.success} />
                <ThemedText style={styles.acknowledgementText}>{item}</ThemedText>
              </View>
            ))}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>CONNECT</ThemedText>
          <View style={styles.socialRow}>
            <Pressable
              style={styles.socialButton}
              onPress={() => handleOpenLink("https://twitter.com/maternalmind")}
            >
              <Feather name="twitter" size={20} color={Colors.dark.text} />
            </Pressable>
            <Pressable
              style={styles.socialButton}
              onPress={() => handleOpenLink("https://instagram.com/maternalmind")}
            >
              <Feather name="instagram" size={20} color={Colors.dark.text} />
            </Pressable>
            <Pressable
              style={styles.socialButton}
              onPress={() => handleOpenLink("https://maternalmind.app")}
            >
              <Feather name="globe" size={20} color={Colors.dark.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.copyright}>
            © 2026 Maternal Mind. All rights reserved.
          </ThemedText>
          <ThemedText style={styles.madeWith}>
            Made with care for medical students worldwide
          </ThemedText>
        </View>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: Spacing.lg,
  },
  appName: {
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  versionCard: {
    marginBottom: Spacing["2xl"],
    padding: Spacing.lg,
  },
  versionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  versionLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  versionValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.glass,
    marginVertical: Spacing.sm,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.lg,
  },
  legalCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  legalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.dark.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  legalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  acknowledgementsCard: {
    padding: 0,
    overflow: "hidden",
  },
  acknowledgementRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  acknowledgementRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.glass,
  },
  acknowledgementText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.md,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.glass,
  },
  copyright: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xs,
  },
  madeWith: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
});
