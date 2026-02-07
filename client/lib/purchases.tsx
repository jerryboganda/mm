import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Platform, Alert } from "react-native";
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";

interface PurchasesContextType {
  isSubscribed: boolean;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[];
  loading: boolean;
  error: string | null;
  purchase: (packageToPurchase: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextType | undefined>(
  undefined,
);

const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || "";
const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || "";
const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro";

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initializePurchases();
  }, []);

  const initializePurchases = async () => {
    try {
      if (Platform.OS === "web") {
        setLoading(false);
        return;
      }

      const apiKey =
        Platform.OS === "ios"
          ? REVENUECAT_API_KEY_IOS
          : REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) {
        if (__DEV__) {
          console.log(
            "RevenueCat API key not configured - running in preview mode",
          );
        }
        setLoading(false);
        return;
      }

      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
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

  const purchase = async (
    packageToPurchase: PurchasesPackage,
  ): Promise<boolean> => {
    try {
      if (!initialized) {
        Alert.alert(
          "Not Available",
          "In-app purchases are not available in preview mode. Please use the app on a real device.",
        );
        return false;
      }

      const { customerInfo: info } =
        await Purchases.purchasePackage(packageToPurchase);
      setCustomerInfo(info);

      const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
      const success = !!entitlement;
      setIsSubscribed(success);

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
          "Restore purchases is not available in preview mode.",
        );
        return false;
      }

      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);

      const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
      const success = !!entitlement;
      setIsSubscribed(success);

      if (success) {
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
        purchase,
        restorePurchases,
        refreshCustomerInfo,
      }}
    >
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  const context = useContext(PurchasesContext);
  if (context === undefined) {
    throw new Error("usePurchases must be used within a PurchasesProvider");
  }
  return context;
}
