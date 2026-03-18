import React from "react";
import { StyleSheet, View, ScrollView, Image, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { DangerActionModal } from "@/components/DangerActionModal";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type ProfileScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

type ProfileActionType = "deactivate" | "delete" | "logout";

export default function ProfileScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, logout, deactivateAccount, requestAccountDeletion } = useAuth();
  const { theme } = useTheme();
  const bottomLayout = useBottomLayout({ extraContentPadding: Spacing.xl });
  const [isProcessingProfileAction, setIsProcessingProfileAction] =
    React.useState(false);
  const [activeProfileAction, setActiveProfileAction] =
    React.useState<ProfileActionType | null>(null);
  const [profileModalMode, setProfileModalMode] = React.useState<
    "confirm" | "success"
  >("confirm");
  const [checkedAcknowledgements, setCheckedAcknowledgements] = React.useState<
    string[]
  >([]);
  const [profileActionError, setProfileActionError] = React.useState<
    string | null
  >(null);

  const handleLogout = () => {
    openProfileAction("logout");
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

  const openProfileAction = (action: ProfileActionType) => {
    setActiveProfileAction(action);
    setProfileModalMode("confirm");
    setCheckedAcknowledgements([]);
    setProfileActionError(null);
  };

  const closeProfileAction = () => {
    if (isProcessingProfileAction || profileModalMode === "success") {
      return;
    }

    setActiveProfileAction(null);
    setCheckedAcknowledgements([]);
    setProfileActionError(null);
  };

  const performProfileAction = async (action: ProfileActionType) => {
    if (isProcessingProfileAction) {
      return;
    }

    setIsProcessingProfileAction(true);
    setProfileActionError(null);

    try {
      if (action === "deactivate") {
        await deactivateAccount();
        setProfileModalMode("success");
      } else if (action === "delete") {
        await requestAccountDeletion();
        setProfileModalMode("success");
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await logout();
      }
    } catch (error: any) {
      setProfileActionError(
        error?.message ||
          "Please try again or contact support if this continues.",
      );
    } finally {
      setIsProcessingProfileAction(false);
    }
  };

  const handleDeactivateAccount = () => {
    openProfileAction("deactivate");
  };

  const handleDeleteAccount = () => {
    openProfileAction("delete");
  };

  const profileActionConfig = activeProfileAction
    ? {
        logout: {
          tone: "warning" as const,
          icon: "log-out" as const,
          eyebrowLabel: "Session",
          title: "Log Out",
          description:
            "You will be signed out of Maternal Mind on this device. Your progress and account data will remain available when you sign back in.",
          confirmLabel: "Log Out",
          confirmIcon: "log-out" as const,
          cancelLabel: "Stay Signed In",
          consequenceTitle: "What happens next",
          consequences: [
            "You can sign back in anytime using your existing account credentials.",
            "Your progress, bookmarks, and subscription access remain attached to your account.",
          ],
          acknowledgements: [],
        },
        deactivate: {
          tone: "warning" as const,
          icon:
            profileModalMode === "success"
              ? ("check-circle" as const)
              : ("pause-circle" as const),
          eyebrowLabel: undefined,
          title:
            profileModalMode === "success"
              ? "Account Deactivated"
              : "Deactivate Account",
          description:
            profileModalMode === "success"
              ? "Your account has been deactivated. Sign out now to finish this action."
              : "This will immediately disable access to your account. You will need support assistance to reactivate it later.",
          confirmLabel:
            profileModalMode === "success"
              ? "Sign Out Now"
              : "Deactivate Account",
          confirmIcon:
            profileModalMode === "success"
              ? ("log-out" as const)
              : ("pause-circle" as const),
          cancelLabel: "Keep Account",
          consequenceTitle:
            profileModalMode === "success" ? "Next step" : "What happens next",
          consequences:
            profileModalMode === "success"
              ? [
                  "You will be signed out immediately after confirming below.",
                  "Future sign-ins will be blocked until support reactivates the account.",
                ]
              : [
                  "You will lose access to the app until support reactivates your account.",
                  "Your data stays preserved, but normal app usage is blocked.",
                ],
          acknowledgements:
            profileModalMode === "success"
              ? []
              : [
                  {
                    id: "deactivate-access",
                    label:
                      "I understand I will be signed out and need support to regain access.",
                  },
                ],
        },
        delete: {
          tone: "danger" as const,
          icon:
            profileModalMode === "success"
              ? ("check-circle" as const)
              : ("trash-2" as const),
          eyebrowLabel: undefined,
          title:
            profileModalMode === "success"
              ? "Deletion Requested"
              : "Delete Account",
          description:
            profileModalMode === "success"
              ? "Your deletion request has been received. Sign out now to complete this flow."
              : "This submits a verified request to remove your account and associated data. We may contact you to confirm identity before processing the deletion.",
          confirmLabel:
            profileModalMode === "success"
              ? "Sign Out Now"
              : "Request Deletion",
          confirmIcon:
            profileModalMode === "success"
              ? ("log-out" as const)
              : ("trash-2" as const),
          cancelLabel: "Keep Account",
          consequenceTitle:
            profileModalMode === "success"
              ? "What to expect"
              : "Before you continue",
          consequences:
            profileModalMode === "success"
              ? [
                  "Your request is now pending review and processing.",
                  "Subscription billing must still be canceled separately in Google Play or the App Store.",
                ]
              : [
                  "This does not automatically cancel Google Play or App Store billing.",
                  "Progress, bookmarks, preferences, and associated account data are part of the deletion request.",
                ],
          acknowledgements:
            profileModalMode === "success"
              ? []
              : [
                  {
                    id: "delete-data",
                    label:
                      "I understand this requests deletion of my account and associated data.",
                  },
                  {
                    id: "delete-billing",
                    label:
                      "I understand subscription billing must be canceled separately in Google Play or the App Store.",
                  },
                ],
        },
      }[activeProfileAction]
    : null;

  const toggleAcknowledgement = (id: string) => {
    setCheckedAcknowledgements((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const handleDangerModalConfirm = () => {
    if (!activeProfileAction) {
      return;
    }

    if (profileModalMode === "success") {
      void logout();
      return;
    }

    void performProfileAction(activeProfileAction);
  };

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

  const dangerItems = [
    {
      id: "deactivate",
      title: "Deactivate Account",
      subtitle: "Temporarily disable access and sign out",
      icon: "pause-circle" as const,
      color: theme.warning,
      onPress: handleDeactivateAccount,
    },
    {
      id: "delete",
      title: "Delete Account",
      subtitle: "Request permanent removal of your account and data",
      icon: "trash-2" as const,
      color: theme.error,
      onPress: handleDeleteAccount,
    },
  ];

  return (
    <BackgroundGradient>
      {profileActionConfig ? (
        <DangerActionModal
          visible
          mode={profileModalMode}
          tone={profileActionConfig.tone}
          icon={profileActionConfig.icon}
          eyebrowLabel={profileActionConfig.eyebrowLabel}
          title={profileActionConfig.title}
          description={profileActionConfig.description}
          confirmLabel={profileActionConfig.confirmLabel}
          confirmIcon={profileActionConfig.confirmIcon}
          cancelLabel={profileActionConfig.cancelLabel}
          consequenceTitle={profileActionConfig.consequenceTitle}
          consequences={profileActionConfig.consequences}
          acknowledgements={profileActionConfig.acknowledgements}
          checkedAcknowledgements={checkedAcknowledgements}
          onToggleAcknowledgement={toggleAcknowledgement}
          onClose={closeProfileAction}
          onConfirm={handleDangerModalConfirm}
          loading={isProcessingProfileAction}
          errorMessage={profileActionError}
          dismissible={
            profileModalMode === "confirm" && !isProcessingProfileAction
          }
        />
      ) : null}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: bottomLayout.contentBottomInset,
          },
        ]}
        scrollIndicatorInsets={{
          bottom: bottomLayout.scrollIndicatorBottomInset,
        }}
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

        <View style={styles.settingsSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.error }]}>
            DANGER ZONE
          </ThemedText>
          {dangerItems.map((item) => (
            <GlassCard
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              onPress={isProcessingProfileAction ? undefined : item.onPress}
              icon={<Feather name={item.icon} size={20} color={item.color} />}
              rightElement={
                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.textSecondary}
                />
              }
              style={[
                styles.dangerCard,
                {
                  marginBottom: Spacing.md,
                  borderColor: `${item.color}4D`,
                  opacity: isProcessingProfileAction ? 0.7 : 1,
                },
              ]}
              testID={`card-danger-${item.id}`}
            />
          ))}
        </View>

        <View style={styles.settingsSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.warning }]}>
            SESSION
          </ThemedText>
          <GlassCard
            title="Log Out"
            subtitle="Sign out on this device"
            onPress={isProcessingProfileAction ? undefined : handleLogout}
            icon={<Feather name="log-out" size={20} color={theme.warning} />}
            rightElement={
              <Feather
                name="chevron-right"
                size={20}
                color={theme.textSecondary}
              />
            }
            style={[
              styles.logoutCard,
              {
                borderColor: `${theme.warning}40`,
                opacity: isProcessingProfileAction ? 0.7 : 1,
              },
            ]}
            testID="button-logout"
          />
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
  dangerCard: {
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.lg,
  },
  logoutCard: {
    borderWidth: 1,
  },
});
