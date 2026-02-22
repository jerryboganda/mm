import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Switch,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SettingsScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const { theme, themeMode, setThemeMode } = useTheme();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [studyReminders, setStudyReminders] = useState(true);
  const [quizReminders, setQuizReminders] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                if (Platform.OS !== "web") {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
        return;
      }
    }
    if (hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPushNotifications(value);
  };

  const handleToggle =
    (setter: (value: boolean) => void) => (value: boolean) => {
      if (hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setter(value);
    };

  type SettingItem = {
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof Feather.glyphMap;
    value?: boolean;
    onToggle?: (value: boolean) => void | Promise<void>;
    disabled?: boolean;
    type?: "toggle" | "navigation" | "selection";
    onPress?: () => void;
    selected?: boolean;
  };

  type SettingsGroup = {
    title: string;
    items: SettingItem[];
  };

  const settingsGroups: SettingsGroup[] = [
    {
      title: "APPEARANCE",
      items: [
        {
          id: "theme-dark",
          title: "Dark Mode",
          subtitle: "Dark background with glow effects",
          icon: "moon",
          type: "selection",
          selected: themeMode === "dark",
          onPress: () => setThemeMode("dark"),
        },
        {
          id: "theme-light",
          title: "Light Mode",
          subtitle: "Light background for daytime",
          icon: "sun",
          type: "selection",
          selected: themeMode === "light",
          onPress: () => setThemeMode("light"),
        },
        {
          id: "theme-system",
          title: "Follow System",
          subtitle: "Match your device settings",
          icon: "smartphone",
          type: "selection",
          selected: themeMode === "system",
          onPress: () => setThemeMode("system"),
        },
      ],
    },
    {
      title: "NOTIFICATIONS",
      items: [
        {
          id: "push",
          title: "Push Notifications",
          subtitle: "Receive alerts and updates",
          icon: "bell",
          type: "toggle",
          value: pushNotifications,
          onToggle: handleToggleNotifications,
        },
        {
          id: "study-reminders",
          title: "Study Reminders",
          subtitle: "Daily study goal reminders",
          icon: "clock",
          type: "toggle",
          value: studyReminders,
          onToggle: handleToggle(setStudyReminders),
          disabled: !pushNotifications,
        },
        {
          id: "quiz-reminders",
          title: "Quiz Reminders",
          subtitle: "Weekly quiz practice reminders",
          icon: "calendar",
          type: "toggle",
          value: quizReminders,
          onToggle: handleToggle(setQuizReminders),
          disabled: !pushNotifications,
        },
      ],
    },
    {
      title: "FEEDBACK",
      items: [
        {
          id: "sounds",
          title: "Sound Effects",
          subtitle: "Play sounds for actions",
          icon: "volume-2",
          type: "toggle",
          value: soundEffects,
          onToggle: handleToggle(setSoundEffects),
        },
        {
          id: "haptics",
          title: "Haptic Feedback",
          subtitle: "Vibration for interactions",
          icon: "smartphone",
          type: "toggle",
          value: hapticFeedback,
          onToggle: handleToggle(setHapticFeedback),
        },
      ],
    },
    {
      title: "ACCOUNT & SECURITY",
      items: [
        {
          id: "security",
          title: "Security Settings",
          subtitle: "Password and login options",
          icon: "shield",
          type: "navigation",
          onPress: () => navigation.navigate("SecuritySettings"),
        },
      ],
    },
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
        {settingsGroups.map((group) => (
          <View key={group.title} style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
              {group.title}
            </ThemedText>
            {group.items.map((item) => (
              <GlassCard
                key={item.id}
                style={
                  item.disabled
                    ? [styles.settingCard, styles.settingCardDisabled]
                    : styles.settingCard
                }
                onPress={
                  item.type === "navigation" || item.type === "selection"
                    ? () => {
                      if (hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      item.onPress?.();
                    }
                    : undefined
                }
              >
                <View style={styles.settingRow}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: `${theme.primary}15` },
                      item.disabled && { backgroundColor: theme.glass },
                    ]}
                  >
                    <Feather
                      name={item.icon}
                      size={18}
                      color={
                        item.disabled
                          ? theme.textMuted
                          : theme.primary
                      }
                    />
                  </View>
                  <View style={styles.settingContent}>
                    <ThemedText
                      style={[
                        styles.settingTitle,
                        item.disabled && { color: theme.textMuted },
                      ]}
                    >
                      {item.title}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.settingSubtitle,
                        { color: theme.textSecondary },
                        item.disabled && { color: theme.textMuted },
                      ]}
                    >
                      {item.subtitle}
                    </ThemedText>
                  </View>
                  {item.type === "navigation" ? (
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={theme.textSecondary}
                    />
                  ) : item.type === "selection" ? (
                    item.selected && (
                      <Feather
                        name="check"
                        size={20}
                        color={theme.primary}
                      />
                    )
                  ) : (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      disabled={item.disabled}
                      trackColor={{
                        false: theme.glass,
                        true: theme.primary,
                      }}
                      thumbColor="#fff"
                      ios_backgroundColor={theme.glass}
                    />
                  )}
                </View>
              </GlassCard>
            ))}
          </View>
        ))}
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
  settingCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  settingCardDisabled: {
    opacity: 0.5,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
  },
});
