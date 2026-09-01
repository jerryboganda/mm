import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";

import { useNetwork } from "@/lib/network";
import { useAuth } from "@/lib/auth";
import { SessionExpiredModal } from "@/components/SessionExpiredModal";
import { OfflineBanner } from "@/components/OfflineBanner";
import { queryClient } from "@/lib/query-client";

interface AppNetworkWrapperProps {
  children: ReactNode;
}

export function AppNetworkWrapper({ children }: AppNetworkWrapperProps) {
  const { isOffline, refresh } = useNetwork();
  const { isSessionExpired, dismissSessionExpired, logout } = useAuth();
  const navigation = useNavigation();

  const handleRetry = async () => {
    await refresh();
  };

  const handleSessionLogin = async () => {
    await logout();
    dismissSessionExpired();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Login" as never }],
      }),
    );
  };

  // Count how many cached queries the user can access offline
  const cachedQueryCount = isOffline
    ? queryClient
        .getQueryCache()
        .getAll()
        .filter(
          (q) => q.state.status === "success" && q.state.data !== undefined,
        ).length
    : 0;

  return (
    <View style={styles.root}>
      <OfflineBanner
        isOffline={isOffline}
        cachedQueryCount={cachedQueryCount}
        onRetry={handleRetry}
      />
      {children}
      <SessionExpiredModal
        visible={isSessionExpired}
        onLogin={handleSessionLogin}
        onDismiss={dismissSessionExpired}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
