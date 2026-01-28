import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Switch, Alert, Platform, Linking } from "react-native";
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
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<SettingsScreenNavigationProp>();

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
          ]
        );
        return;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPushNotifications(value);
  };

  const handleToggle = (setter: (value: boolean) => void) => (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    type?: "toggle" | "navigation";
    onPress?: () => void;
  };

  type SettingsGroup = {
    title: string;
    items: SettingItem[];
  };

  const settingsGroups: SettingsGroup[] = [
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
            <ThemedText style={styles.sectionLabel}>{group.title}</ThemedText>
            {group.items.map((item) => (
              <GlassCard
                key={item.id}
                style={item.disabled ? [styles.settingCard, styles.settingCardDisabled] : styles.settingCard}
                onPress={item.type === "navigation" ? item.onPress : undefined}
              >
                <View style={styles.settingRow}>
                  <View
                    style={[
                      styles.iconContainer,
                      item.disabled && styles.iconContainerDisabled,
                    ]}
                  >
                    <Feather
                      name={item.icon}
                      size={18}
                      color={item.disabled ? Colors.dark.textMuted : Colors.dark.primary}
                    />
                  </View>
                  <View style={styles.settingContent}>
                    <ThemedText
                      style={[
                        styles.settingTitle,
                        item.disabled && styles.settingTitleDisabled,
                      ]}
                    >
                      {item.title}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.settingSubtitle,
                        item.disabled && styles.settingSubtitleDisabled,
                      ]}
                    >
                      {item.subtitle}
                    </ThemedText>
                  </View>
                  {item.type === "navigation" ? (
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={Colors.dark.textSecondary}
                    />
                  ) : (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      disabled={item.disabled}
                      trackColor={{
                        false: Colors.dark.glass,
                        true: Colors.dark.primary,
                      }}
                      thumbColor="#fff"
                      ios_backgroundColor={Colors.dark.glass}
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
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
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
    backgroundColor: `${Colors.dark.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  iconContainerDisabled: {
    backgroundColor: Colors.dark.glass,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  settingTitleDisabled: {
    color: Colors.dark.textMuted,
  },
  settingSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  settingSubtitleDisabled: {
    color: Colors.dark.textMuted,
  },
});
