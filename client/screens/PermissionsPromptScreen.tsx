import React, { useState } from "react";
import { StyleSheet, View, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GlassCard } from "@/components/GlassCard";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const ONBOARDING_COMPLETE_KEY = "@maternal_mind_onboarding_complete";

type PermissionsPromptScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PermissionsPromptScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PermissionsPromptScreenNavigationProp>();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === "granted") {
        await completeOnboarding();
        return;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status === "denied" && Platform.OS !== "web") {
        try {
          await Linking.openSettings();
        } catch (error) {
        }
      }
      
      await completeOnboarding();
    } catch (error) {
      await completeOnboarding();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch (error) {
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "Register" }],
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.backgroundRoot, "#0a1518", Colors.dark.backgroundRoot]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.mainContent}>
          <View style={styles.iconContainer}>
            <View style={styles.iconRing}>
              <Feather name="bell" size={64} color={Colors.dark.primary} />
            </View>
          </View>

          <ThemedText type="h2" style={styles.title}>
            Stay on Track
          </ThemedText>
          <ThemedText style={styles.description}>
            Enable notifications to receive study reminders, quiz alerts, and updates
            on your learning progress.
          </ThemedText>

          <GlassCard style={styles.benefitsCard}>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Feather name="clock" size={20} color={Colors.dark.primary} />
              </View>
              <View style={styles.benefitText}>
                <ThemedText style={styles.benefitTitle}>Study Reminders</ThemedText>
                <ThemedText style={styles.benefitDesc}>
                  Get gentle nudges to keep your study streak
                </ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Feather name="award" size={20} color={Colors.dark.warning} />
              </View>
              <View style={styles.benefitText}>
                <ThemedText style={styles.benefitTitle}>Achievement Alerts</ThemedText>
                <ThemedText style={styles.benefitDesc}>
                  Celebrate your milestones and progress
                </ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Feather name="zap" size={20} color={Colors.dark.success} />
              </View>
              <View style={styles.benefitText}>
                <ThemedText style={styles.benefitTitle}>New Content</ThemedText>
                <ThemedText style={styles.benefitDesc}>
                  Be first to know about new topics and quizzes
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </View>

        <View style={styles.buttonSection}>
          <PrimaryButton
            title="Enable Notifications"
            onPress={handleEnableNotifications}
            loading={isRequesting}
            icon={<Feather name="bell" size={20} color={Colors.dark.backgroundRoot} />}
            style={styles.enableButton}
            testID="button-enable-notifications"
          />
          <PrimaryButton
            title="Maybe Later"
            onPress={handleSkip}
            variant="ghost"
            style={styles.skipButton}
            testID="button-skip-notifications"
          />
        </View>
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
    justifyContent: "space-between",
  },
  mainContent: {
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: Spacing["2xl"],
  },
  iconRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(17,164,212,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(17,164,212,0.3)",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing["2xl"],
    maxWidth: 300,
  },
  benefitsCard: {
    width: "100%",
    padding: Spacing.lg,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(17,164,212,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.glassBorder,
    marginVertical: Spacing.sm,
  },
  buttonSection: {
    gap: Spacing.md,
  },
  enableButton: {
    width: "100%",
  },
  skipButton: {
    width: "100%",
  },
});
