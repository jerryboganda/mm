import { useState, useEffect, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * React hook that monitors network connectivity status using NetInfo.
 * Subscribes to real-time connection changes and exposes a manual refresh function.
 *
 * @returns An object containing:
 *  - `isConnected` — Whether the device has a network connection (null while unknown)
 *  - `isInternetReachable` — Whether the internet is actually reachable (null while unknown)
 *  - `isOffline` — Convenience boolean: true when disconnected or internet unreachable
 *  - `refresh` — Async function to manually re-check connectivity; returns true if online
 */
export function useNetworkStatus() {
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
    return state.isConnected && state.isInternetReachable;
  }, []);

  return {
    isConnected,
    isInternetReachable,
    isOffline,
    refresh,
  };
}
