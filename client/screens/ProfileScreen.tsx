import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type ProfileScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
        },
      },
    ]);
  };

  const getSubscriptionBadge = () => {
    switch (user?.subscriptionStatus) {
      case "active":
        return { label: "Premium", color: theme.success };
      case "expired":
        return { label: "Expired", color: theme.error };
      default:
        return { label: "Free", color: theme.textSecondary };
    }
  };

  const subscriptionBadge = getSubscriptionBadge();

  const settingsItems = [
    {
      id: "subscription",
      title: "Subscription",
      subtitle: user?.subscriptionPlan || "Manage your subscription",
      icon: "credit-card" as const,
      onPress: () => navigation.navigate("Subscription"),
    },
    {
      id: "bookmarks",
      title: "Bookmarks",
      subtitle: "Your saved topics",
      icon: "bookmark" as const,
      onPress: () => navigation.navigate("Bookmarks"),
    },
    {
      id: "recent-activity",
      title: "Recent Activity",
      subtitle: "Continue where you left off",
      icon: "clock" as const,
      onPress: () => navigation.navigate("RecentActivity"),
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "App preferences and notifications",
      icon: "settings" as const,
      onPress: () => navigation.navigate("Settings"),
    },
    {
      id: "help",
      title: "Help & Support",
      subtitle: "FAQs and contact",
      icon: "help-circle" as const,
      onPress: () => navigation.navigate("HelpSupport"),
    },
    {
      id: "about",
      title: "About",
      subtitle: "Version 1.0.0",
      icon: "info" as const,
      onPress: () => navigation.navigate("About"),
    },
  ];

  // Admin-only items
  const adminItems =
    user?.role === "admin"
      ? [
        {
          id: "admin-email",
          title: "Email Settings",
          subtitle: "Configure Brevo SMTP & test emails",
          icon: "mail" as const,
          onPress: () => navigation.navigate("AdminEmailSettings" as any),
        },
      ]
      : [];

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.profileSection}>
          <Pressable
            style={styles.avatarContainer}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("EditProfile");
            }}
            testID="button-edit-profile"
          >
            <Image
              source={require("../../assets/images/default-avatar.png")}
              style={[styles.avatar, { borderColor: theme.primary }]}
              resizeMode="cover"
            />
            <View
              style={[
                styles.editBadge,
                {
                  backgroundColor: theme.primary,
                  borderColor: theme.backgroundRoot,
                },
              ]}
            >
              <Feather name="edit-2" size={12} color="#fff" />
            </View>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: subscriptionBadge.color,
                  borderColor: theme.backgroundRoot,
                },
              ]}
            />
          </Pressable>
          <ThemedText type="h3" style={styles.userName} numberOfLines={1}>
            {user?.name || "Student"}
          </ThemedText>
          <ThemedText
            style={[styles.userEmail, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {user?.email || "student@example.com"}
          </ThemedText>
          <View
            style={[
              styles.subscriptionBadge,
              { backgroundColor: `${subscriptionBadge.color}20` },
            ]}
          >
            <ThemedText
              style={[
                styles.subscriptionText,
                { color: subscriptionBadge.color },
              ]}
            >
              {subscriptionBadge.label}
            </ThemedText>
          </View>
        </View>

        {user?.subscriptionStatus !== "active" ? (
          <GlassCard
            style={[styles.upgradeCard, { borderColor: theme.warning }]}
            onPress={() => navigation.navigate("Subscription")}
          >
            <View style={styles.upgradeContent}>
              <View
                style={[
                  styles.upgradeIcon,
                  { backgroundColor: `${theme.warning}33` },
                ]}
              >
                <Feather name="zap" size={24} color={theme.warning} />
              </View>
              <View style={styles.upgradeText}>
                <ThemedText type="h4" style={styles.upgradeTitle}>
                  Upgrade to Premium
                </ThemedText>
                <ThemedText
                  style={[
                    styles.upgradeSubtitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  Unlock all content and features
                </ThemedText>
              </View>
              <Feather
                name="chevron-right"
                size={24}
                color={theme.textSecondary}
              />
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.settingsSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            SETTINGS
          </ThemedText>
          {settingsItems.map((item) => (
            <GlassCard
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              onPress={item.onPress}
              icon={
                <Feather name={item.icon} size={20} color={theme.primary} />
              }
              rightElement={
                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.textSecondary}
                />
              }
              style={{ marginBottom: Spacing.md }}
              testID={`card-settings-${item.id}`}
            />
          ))}
        </View>

        {adminItems.length > 0 ? (
          <View style={styles.settingsSection}>
            <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
              ADMIN PANEL
            </ThemedText>
            {adminItems.map((item) => (
              <GlassCard
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                onPress={item.onPress}
                icon={
                  <Feather name={item.icon} size={20} color={theme.warning} />
                }
                rightElement={
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={theme.textSecondary}
                  />
                }
                style={{ marginBottom: Spacing.md }}
                testID={`card-admin-${item.id}`}
              />
            ))}
          </View>
        ) : null}

        <PrimaryButton
          title="Log Out"
          onPress={handleLogout}
          variant="ghost"
          style={styles.logoutButton}
          testID="button-logout"
        />
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
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatarContainer: {
    position: "relative",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
  },
  statusDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
  },
  editBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  userName: {
    marginBottom: Spacing.xs,
  },
  userEmail: {
    marginBottom: Spacing.md,
  },
  subscriptionBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  subscriptionText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  upgradeCard: {
    marginBottom: Spacing["2xl"],
    borderWidth: 1,
  },
  upgradeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  upgradeIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  upgradeText: {
    flex: 1,
  },
  upgradeTitle: {
    marginBottom: Spacing.xs,
  },
  upgradeSubtitle: {
    fontSize: 13,
  },
  settingsSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.lg,
  },
  logoutButton: {
    marginTop: Spacing.lg,
  },
});
