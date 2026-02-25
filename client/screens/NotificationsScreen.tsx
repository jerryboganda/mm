import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, ThemeColors } from "@/constants/theme";
import { useMobileContent } from "@/lib/mobile-content";

type Announcement = {
  id: string;
  title: string;
  message: string;
  type: "new_content" | "update" | "info" | "important";
  createdAt: string;
  isRead: boolean;
};

function getTypeIcon(type: Announcement["type"]) {
  switch (type) {
    case "new_content":
      return "book";
    case "update":
      return "refresh-cw";
    case "important":
      return "alert-circle";
    default:
      return "info";
  }
}

function getTypeColor(type: Announcement["type"], theme: ThemeColors) {
  switch (type) {
    case "new_content":
      return theme.success;
    case "update":
      return theme.primary;
    case "important":
      return theme.warning;
    default:
      return theme.info;
  }
}

function formatTimeAgo(dateString: string, t: (value: string) => string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}${t("m ago")}`;
  if (diffHours < 24) return `${diffHours}${t("h ago")}`;
  if (diffDays === 1) return t("Yesterday");
  if (diffDays < 7) return `${diffDays}${t("d ago")}`;
  return date.toLocaleDateString();
}

function AnnouncementCard({ item }: { item: Announcement }) {
  const { theme } = useTheme();
  const { resolveText } = useMobileContent();
  const t = resolveText;
  const typeColor = getTypeColor(item.type, theme);
  const typeIcon = getTypeIcon(item.type);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: theme.glass,
          borderColor: item.isRead ? theme.glassBorder : typeColor,
          opacity: item.isRead ? 0.7 : 1,
        },
      ]}
      onPress={handlePress}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: `${typeColor}20` }]}
      >
        <Feather name={typeIcon as any} size={20} color={typeColor} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text
            style={[styles.cardTitle, { color: theme.text }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {!item.isRead && (
            <View style={[styles.unreadDot, { backgroundColor: typeColor }]} />
          )}
        </View>
        <Text
          style={[styles.cardMessage, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {item.message}
        </Text>
        <Text style={[styles.cardTime, { color: theme.textMuted }]}>
          {formatTimeAgo(item.createdAt, t)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { resolveText } = useMobileContent();
  const t = resolveText;
  const [refreshing, setRefreshing] = React.useState(false);

  const {
    data: announcements,
    isLoading,
    refetch,
  } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  };

  const unreadCount = announcements?.filter((a) => !a.isRead).length || 0;

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={announcements}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <AnnouncementCard item={item} />}
      ListHeaderComponent={
        unreadCount > 0 ? (
          <View style={styles.headerSection}>
            <Text style={[styles.unreadLabel, { color: theme.primary }]}>
              {unreadCount} {t("new")}{" "}
              {unreadCount === 1 ? t("announcement") : t("announcements")}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Feather name="bell-off" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t("No Announcements")}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {t("Check back later for updates from your professors")}
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSection: {
    marginBottom: Spacing.lg,
  },
  unreadLabel: {
    ...Typography.small,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
  cardMessage: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  cardTime: {
    ...Typography.caption,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["5xl"],
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
});
