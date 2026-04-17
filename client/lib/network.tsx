import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import NetInfo from "@react-native-community/netinfo";

/** Describes the network connectivity state and a manual refresh function. */
interface NetworkContextType {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  isOffline: boolean;
  refresh: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

/**
 * Context provider that monitors device network connectivity using NetInfo.
 * Subscribes to real-time connectivity changes and exposes connection state to descendants.
 *
 * @param props.children - Child components that will have access to the network context.
 * @returns A provider component wrapping children with network state.
 */
export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<
    boolean | null
  >(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
    });

    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
    });

    return () => unsubscribe();
  }, []);

  const isOffline = isConnected === false || isInternetReachable === false;

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    setIsConnected(state.isConnected);
    setIsInternetReachable(state.isInternetReachable);
    return !!(state.isConnected && state.isInternetReachable);
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        isOffline,
        refresh,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * Hook to access the current network connectivity state.
 * Must be used within a {@link NetworkProvider}.
 *
 * @returns The current {@link NetworkContextType} value.
 * @throws If used outside of a NetworkProvider.
 */
export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
