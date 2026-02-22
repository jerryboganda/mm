import { Platform } from "react-native";
import { QueryClient } from "@tanstack/react-query";

/**
 * Offline Query Cache Persistence
 *
 * Persists React Query cache to AsyncStorage so content
 * is available when the user goes offline.
 *
 * Only caches GET responses for content endpoints (books, chapters, topics).
 * Quiz and progress data is NOT cached to ensure consistency.
 */

const CACHE_KEY = "maternal-mind-query-cache";

// Keys that should be persisted for offline access
const OFFLINE_QUERY_KEYS = [
  "/api/books",
  "/api/quiz/topics",
  "/api/quiz/stats",
];

// Prefix matches â€” any query starting with these will be cached
const OFFLINE_QUERY_PREFIXES = [
  "/api/books/", // chapters
  "/api/chapters/", // topics
  "/api/topics/", // topic content
];

function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const key = queryKey[0];
  if (typeof key !== "string") return false;

  if (OFFLINE_QUERY_KEYS.includes(key)) return true;
  return OFFLINE_QUERY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function getStorage() {
  if (Platform.OS === "web") {
    return {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key);
        return Promise.resolve();
      },
    };
  }

  // Lazy import for native
  const AsyncStorage = await import(
    "@react-native-async-storage/async-storage"
  );
  return AsyncStorage.default;
}

/**
 * Save eligible query cache entries to persistent storage.
 * Call this periodically or on app background.
 */
export async function persistQueryCache(
  queryClient: QueryClient,
): Promise<void> {
  try {
    const storage = await getStorage();
    const cache = queryClient.getQueryCache().getAll();

    const entriesToPersist = cache
      .filter((query) => {
        return (
          query.state.status === "success" &&
          query.state.data !== undefined &&
          shouldPersistQuery(query.queryKey)
        );
      })
      .map((query) => ({
        queryKey: query.queryKey,
        data: query.state.data,
        dataUpdatedAt: query.state.dataUpdatedAt,
      }));

    await storage.setItem(CACHE_KEY, JSON.stringify(entriesToPersist));
  } catch (error) {
    console.warn("[OfflineCache] Failed to persist:", error);
  }
}

/**
 * Restore query cache from persistent storage.
 * Call this on app startup, before any queries run.
 */
export async function restoreQueryCache(
  queryClient: QueryClient,
): Promise<void> {
  try {
    const storage = await getStorage();
    const cached = await storage.getItem(CACHE_KEY);

    if (!cached) return;

    const entries = JSON.parse(cached) as {
      queryKey: unknown[];
      data: unknown;
      dataUpdatedAt: number;
    }[];

    for (const entry of entries) {
      queryClient.setQueryData(entry.queryKey, entry.data, {
        updatedAt: entry.dataUpdatedAt,
      });
    }

    if (__DEV__) {
      console.log(`[OfflineCache] Restored ${entries.length} cached queries`);
    }
  } catch (error) {
    console.warn("[OfflineCache] Failed to restore:", error);
  }
}

/**
 * Clear the offline cache.
 */
export async function clearOfflineCache(): Promise<void> {
  try {
    const storage = await getStorage();
    await storage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn("[OfflineCache] Failed to clear:", error);
  }
}
