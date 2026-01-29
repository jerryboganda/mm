import React, { ReactNode } from "react";
import { useNavigation, CommonActions } from "@react-navigation/native";

import { useNetwork } from "@/lib/network";
import { useAuth } from "@/lib/auth";
import { SessionExpiredModal } from "@/components/SessionExpiredModal";
import OfflineScreen from "@/screens/OfflineScreen";

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

  if (isOffline) {
    return <OfflineScreen onRetry={handleRetry} />;
  }

  return (
    <>
      {children}
      <SessionExpiredModal
        visible={isSessionExpired}
        onLogin={handleSessionLogin}
        onDismiss={dismissSessionExpired}
      />
    </>
  );
}
