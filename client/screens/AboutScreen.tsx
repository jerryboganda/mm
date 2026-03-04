import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Linking,
  Image,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";
import Constants from "expo-constants";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useTheme } from "@/hooks/useTheme";

const appVersion = Constants.expoConfig?.version || "1.0.0";
const buildNumber = Constants.expoConfig?.ios?.buildNumber || "1";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const handleOpenLink = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  };

  const handleNavigate = (screen: keyof RootStackParamList) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screen as any);
  };

  const legalItems = [
    {
      id: "terms",
      title: "Terms & Privacy",
      icon: "file-text" as const,
      screen: "TermsPrivacy" as keyof RootStackParamList,
    },
    {
      id: "disclaimer",
      title: "Medical Disclaimer",
      icon: "alert-circle" as const,
      screen: "Disclaimer" as keyof RootStackParamList,
    },
    {
      id: "licenses",
      title: "Open Source Licenses",
      icon: "code" as const,
      url: "https://maternalmind.com.pk/licenses",
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
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
            OB-GYN Education Made Simple
          </ThemedText>
        </View>

        <GlassCard style={styles.versionCard}>
          <View style={styles.versionRow}>
            <ThemedText style={[styles.versionLabel, { color: theme.textSecondary }]}>Version</ThemedText>
            <ThemedText style={styles.versionValue}>{appVersion}</ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.glass }]} />
          <View style={styles.versionRow}>
            <ThemedText style={[styles.versionLabel, { color: theme.textSecondary }]}>Build</ThemedText>
            <ThemedText style={styles.versionValue}>{buildNumber}</ThemedText>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>LEGAL</ThemedText>
          {legalItems.map((item) => (
            <GlassCard
              key={item.id}
              style={styles.legalCard}
              onPress={() =>
                item.screen
                  ? handleNavigate(item.screen)
                  : handleOpenLink(item.url!)
              }
            >
              <View style={styles.legalRow}>
                <View style={[styles.legalIcon, { backgroundColor: `${theme.primary}15` }]}>
                  <Feather
                    name={item.icon}
                    size={18}
                    color={theme.primary}
                  />
                </View>
                <ThemedText style={styles.legalTitle}>{item.title}</ThemedText>
                <Feather
                  name={item.screen ? "chevron-right" : "external-link"}
                  size={16}
                  color={theme.textSecondary}
                />
              </View>
            </GlassCard>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>ACKNOWLEDGEMENTS</ThemedText>
          <GlassCard style={styles.acknowledgementsCard}>
            {acknowledgements.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.acknowledgementRow,
                  index < acknowledgements.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.glass,
                  },
                ]}
              >
                <Feather name="check" size={14} color={theme.success} />
                <ThemedText style={[styles.acknowledgementText, { color: theme.textSecondary }]}>
                  {item}
                </ThemedText>
              </View>
            ))}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>CONNECT</ThemedText>
          <View style={styles.socialRow}>
            <Pressable
              style={[styles.socialButton, { backgroundColor: theme.glass }]}
              onPress={() => handleOpenLink("https://twitter.com/maternalmind")}
            >
              <Feather name="twitter" size={20} color={theme.text} />
            </Pressable>
            <Pressable
              style={[styles.socialButton, { backgroundColor: theme.glass }]}
              onPress={() =>
                handleOpenLink("https://instagram.com/maternalmind")
              }
            >
              <Feather name="instagram" size={20} color={theme.text} />
            </Pressable>
            <Pressable
              style={[styles.socialButton, { backgroundColor: theme.glass }]}
              onPress={() => handleOpenLink("https://maternalmind.com.pk")}
            >
              <Feather name="globe" size={20} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.glass }]}>
          <ThemedText style={[styles.copyright, { color: theme.textMuted }]}>
            © 2026 Maternal Mind. All rights reserved.
          </ThemedText>
          <ThemedText style={[styles.madeWith, { color: theme.textMuted }]}>
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
    width: 130,
    height: 130,
    borderRadius: 28,
    marginBottom: Spacing.lg,
  },
  tagline: {
    fontSize: 14,
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
  },
  versionValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
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
  acknowledgementText: {
    flex: 1,
    fontSize: 14,
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
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
  },
  copyright: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  madeWith: {
    fontSize: 12,
  },
});
