import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Platform, Alert } from "react-native";
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";

/** Describes the subscription/purchase state and actions available through the purchases context. */
interface PurchasesContextType {
  isSubscribed: boolean;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  purchase: (packageToPurchase: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextType | undefined>(
  undefined,
);

// Read env vars matching the .env file names, with fallbacks for legacy names
const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_RC_API_KEY_IOS ||
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ||
  "";
const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ||
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ||
  "";
// Fallback to the test key if no platform-specific key is set
const REVENUECAT_API_KEY_TEST = process.env.EXPO_PUBLIC_RC_API_KEY_TEST || "";
const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID ||
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ||
  "pro";

function getApiKey(): string {
  const platformKey =
    Platform.OS === "ios" ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  // Use platform-specific key first; only fall back to test key in dev mode
  if (platformKey) return platformKey;
  if (__DEV__) return REVENUECAT_API_KEY_TEST;
  // In release builds, don't use test keys — RevenueCat SDK will block them
  return "";
}

/**
 * Context provider that initialises RevenueCat, manages subscription state,
 * and exposes purchase/restore actions to descendant components.
 * Automatically identifies the authenticated user to RevenueCat and syncs
 * subscription status with the backend.
 *
 * @param props.children - Child components that will have access to the purchases context.
 * @returns A provider component wrapping children with purchase state and actions.
 */
export function PurchasesProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    initializePurchases();
  }, []);

  // When user logs in, identify them to RevenueCat
  useEffect(() => {
    if (initialized && user?.id) {
      Purchases.logIn(user.id)
        .then(async ({ customerInfo: info }) => {
          setCustomerInfo(info);
          const entitlement =
            info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
          setIsSubscribed(!!entitlement);
          // Keep the backend subscription status in lockstep with RevenueCat
          // so a lapsed or cancelled subscription can no longer report a stale
          // "active" status to the hard paywall gate.
          await syncSubscriptionToServer(info);
          await refreshUser();
        })
        .catch((err) => {
          console.error("RevenueCat logIn error:", err);
        });
    }
  }, [initialized, user?.id]);

  const initializePurchases = async () => {
    try {
      if (Platform.OS === "web") {
        setLoading(false);
        return;
      }

      const apiKey = getApiKey();

      if (!apiKey) {
        console.warn(
          "RevenueCat: No API key found. Set EXPO_PUBLIC_RC_API_KEY_ANDROID in eas.json or .env",
        );
        setError("Subscription service not configured");
        setLoading(false);
        return;
      }

      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      } else {
        Purchases.setLogLevel(LOG_LEVEL.ERROR);
      }

      await Purchases.configure({ apiKey });
      setInitialized(true);

      await fetchCustomerInfo();
      await fetchOfferings();
    } catch (err: any) {
      console.error("RevenueCat initialization error:", err);
      setError(err.message || "Failed to initialize purchases");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerInfo = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);

      const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
      setIsSubscribed(!!entitlement);
    } catch (err: any) {
      console.error("Error fetching customer info:", err);
    }
  };

  const fetchOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current && offerings.current.availablePackages.length > 0) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (err: any) {
      console.error("Error fetching offerings:", err);
      setError(err.message || "Failed to fetch subscription options");
    }
  };

  // Sync subscription status to our backend after any purchase/restore
  const syncSubscriptionToServer = useCallback(async (info: CustomerInfo) => {
    try {
      const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
      if (entitlement) {
        await apiRequest("POST", "/api/profile/subscription/sync", {
          subscriptionStatus: "active",
          subscriptionPlan: entitlement.productIdentifier || "premium",
          expiresAt: entitlement.expirationDate || null,
          revenueCatId: info.originalAppUserId,
        });
      } else {
        // No active entitlement — report the lapsed/never-subscribed state so
        // the backend stops reporting a stale "active" status.
        const everSubscribed =
          Object.keys(info.entitlements.all ?? {}).length > 0;
        await apiRequest("POST", "/api/profile/subscription/sync", {
          subscriptionStatus: everSubscribed ? "expired" : "none",
          revenueCatId: info.originalAppUserId,
        });
      }
    } catch (err) {
      // Non-critical — server webhook will also sync
      console.warn("Failed to sync subscription to server:", err);
    }
  }, []);

  const purchase = async (
    packageToPurchase: PurchasesPackage,
  ): Promise<boolean> => {
    try {
      if (!initialized) {
        Alert.alert(
          "Not Available",
          "Subscription service is still loading. Please try again in a moment.",
        );
        return false;
      }

      const { customerInfo: info } =
        await Purchases.purchasePackage(packageToPurchase);
      setCustomerInfo(info);

      const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
      const success = !!entitlement;
      setIsSubscribed(success);

      if (success) {
        // Sync to our backend
        await syncSubscriptionToServer(info);
      }

      return success;
    } catch (err: any) {
      if (!err.userCancelled) {
        console.error("Purchase error:", err);
        Alert.alert(
          "Purchase Failed",
          err.message ||
            "There was an error processing your purchase. Please try again.",
        );
      }
      return false;
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    try {
      if (!initialized) {
        Alert.alert(
          "Not Available",
          "Subscription service is still loading. Please try again in a moment.",
        );
        return false;
      }

      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);

      const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
      const success = !!entitlement;
      setIsSubscribed(success);

      if (success) {
        // Sync restored subscription to backend
        await syncSubscriptionToServer(info);
        Alert.alert(
          "Restored!",
          "Your subscription has been restored successfully.",
        );
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases to restore.",
        );
      }

      return success;
    } catch (err: any) {
      console.error("Restore error:", err);
      Alert.alert(
        "Restore Failed",
        err.message ||
          "There was an error restoring your purchases. Please try again.",
      );
      return false;
    }
  };

  const refreshCustomerInfo = async () => {
    if (initialized) {
      await fetchCustomerInfo();
    }
  };

  return (
    <PurchasesContext.Provider
      value={{
        isSubscribed,
        customerInfo,
        packages,
        loading,
        error,
        initialized,
        purchase,
        restorePurchases,
        refreshCustomerInfo,
      }}
    >
      {children}
    </PurchasesContext.Provider>
  );
}

/**
 * Hook to access subscription state and purchase actions.
 * Must be used within a {@link PurchasesProvider}.
 *
 * @returns The current {@link PurchasesContextType} value.
 * @throws If used outside of a PurchasesProvider.
 */
export function usePurchases() {
  const context = useContext(PurchasesContext);
  if (context === undefined) {
    throw new Error("usePurchases must be used within a PurchasesProvider");
  }
  return context;
}
