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
  "/api/progress",
  "/api/profile/bookmarks",
  "/api/profile",
  "/api/announcements",
  "/api/me",
  "/api/reviews/due",
  "/api/reviews/due-count",
  "/api/progress/recent",
  "/api/progress/recommended",
  "/api/profile/recent-activity",
  "/api/recommended-topics",
];

// Prefix matches — any query starting with these will be cached
const OFFLINE_QUERY_PREFIXES = [
  "/api/books/", // chapters within a book
  "/api/chapters/", // topics within a chapter
  "/api/topics/", // topic content + detail
  "/api/quiz/", // quiz questions for topics
  "/api/attempts/", // quiz attempt history & detail
  "/api/progress/", // progress details
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
 * Only caches successful responses for content endpoints (books, chapters, topics, etc.).
 * Call this periodically or on app background.
 *
 * @param queryClient - The TanStack QueryClient instance whose cache to persist
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
 * Call this on app startup, before any queries run, to hydrate the cache for offline use.
 *
 * @param queryClient - The TanStack QueryClient instance to hydrate
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
 * Clear all persisted offline cache data from storage.
 */
export async function clearOfflineCache(): Promise<void> {
  try {
    const storage = await getStorage();
    await storage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn("[OfflineCache] Failed to clear:", error);
  }
}

/**
 * Start a periodic cache persistence interval.
 * Persists the query cache every `intervalMs` milliseconds (default 60 s).
 *
 * @param queryClient - The TanStack QueryClient instance whose cache to persist
 * @param intervalMs - Interval in milliseconds between persist operations (default 60000)
 * @returns A cleanup function that stops the interval when called
 */
export function startPeriodicPersist(
  queryClient: QueryClient,
  intervalMs = 60_000,
): () => void {
  const id = setInterval(() => {
    persistQueryCache(queryClient).catch(console.warn);
  }, intervalMs);

  return () => clearInterval(id);
}

/**
 * Subscribe to query-cache changes and persist when new data arrives for offline-eligible queries.
 * Uses a debounce window so rapid successive fetches don't hammer storage.
 *
 * @param queryClient - The TanStack QueryClient instance to observe
 * @param debounceMs - Debounce window in milliseconds (default 3000)
 * @returns An unsubscribe function that stops listening and clears any pending debounce timer
 */
export function persistOnQuerySuccess(
  queryClient: QueryClient,
  debounceMs = 3_000,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (
      event?.type === "updated" &&
      event.action?.type === "success" &&
      shouldPersistQuery(event.query.queryKey)
    ) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        persistQueryCache(queryClient).catch(console.warn);
      }, debounceMs);
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
