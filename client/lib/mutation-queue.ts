import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { apiRequest } from "@/lib/query-client";

/**
 * Offline Mutation Queue
 *
 * When the user is offline, actions like "bookmark", "mark complete",
 * "mark uncomplete", and "quiz submit" are queued to AsyncStorage.
 * When connectivity is restored the queue is drained automatically.
 *
 * Only idempotent or last-write-wins mutations are queued.
 */

const QUEUE_KEY = "maternal-mind-mutation-queue";

export interface QueuedMutation {
  id: string;
  method: string; // "POST" | "PATCH" | "DELETE"
  route: string; // e.g. "/api/topics/abc/complete"
  data?: unknown;
  createdAt: number; // unix ms
}

// â”€â”€ Storage helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getStorage() {
  if (Platform.OS === "web") {
    return {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
    };
  }
  const AsyncStorage = await import(
    "@react-native-async-storage/async-storage"
  );
  return AsyncStorage.default;
}

// â”€â”€ Queue operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Retrieve all currently queued mutations from persistent storage.
 * @returns An array of queued mutation entries, or an empty array on error
 */
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  try {
    const storage = await getStorage();
    const raw = await storage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    const storage = await getStorage();
    await storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn("[MutationQueue] Failed to save:", error);
  }
}

/**
 * Enqueue a mutation for later execution if the device is currently offline.
 * If the same route+method already exists in the queue, it is replaced (last-write-wins).
 *
 * @param method - HTTP method (e.g. "POST", "PATCH", "DELETE")
 * @param route - The API route path (e.g. "/api/topics/abc/complete")
 * @param data - Optional request body payload
 * @returns `true` if the mutation was queued (device is offline), `false` if the caller should execute immediately (device is online)
 */
export async function enqueueMutationIfOffline(
  method: string,
  route: string,
  data?: unknown,
): Promise<boolean> {
  const netState = await NetInfo.fetch();
  const isOnline = !!(
    netState.isConnected && netState.isInternetReachable !== false
  );

  if (isOnline) return false; // caller should execute immediately

  const mutation: QueuedMutation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method,
    route,
    data,
    createdAt: Date.now(),
  };

  const queue = await getQueuedMutations();

  // De-duplicate: if the same route+method exists, replace it (last-write-wins)
  const filtered = queue.filter(
    (m) => !(m.route === route && m.method === method),
  );
  filtered.push(mutation);
  await saveQueue(filtered);

  if (__DEV__) {
    console.log(`[MutationQueue] Queued: ${method} ${route}`);
  }
  return true;
}

/**
 * Drain the queue — replay all queued mutations sequentially.
 * Called automatically when connectivity is restored.
 * Client errors (4xx) are discarded; server/network errors remain in the queue for retry.
 *
 * @returns An object with `succeeded` (count of successful replays) and `failed` (count of failures)
 */
export async function drainMutationQueue(): Promise<{
  succeeded: number;
  failed: number;
}> {
  const queue = await getQueuedMutations();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  if (__DEV__) {
    console.log(`[MutationQueue] Draining ${queue.length} mutationsâ€¦`);
  }

  let succeeded = 0;
  let failed = 0;
  const remaining: QueuedMutation[] = [];

  for (const mutation of queue) {
    try {
      await apiRequest(mutation.method, mutation.route, mutation.data);
      succeeded++;
    } catch (error) {
      // If it's a client error (4xx), drop it â€” retrying won't help
      const msg = (error as Error)?.message || "";
      if (/^4\d{2}:/.test(msg)) {
        failed++;
        // discard
      } else {
        // Server error or network still down â€” keep in queue
        remaining.push(mutation);
        failed++;
      }
    }
  }

  await saveQueue(remaining);

  if (__DEV__) {
    console.log(
      `[MutationQueue] Drained: ${succeeded} ok, ${failed} failed, ${remaining.length} remaining`,
    );
  }

  return { succeeded, failed };
}

/**
 * Start a NetInfo listener that automatically drains the mutation queue
 * whenever the device transitions from offline to online.
 * Call once at app startup.
 *
 * @returns An unsubscribe function that removes the network listener
 */
export function startMutationQueueListener(): () => void {
  let wasOffline = false;

  const unsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = !!(
      state.isConnected && state.isInternetReachable !== false
    );

    if (isOnline && wasOffline) {
      // Just came back online â€” drain the queue
      drainMutationQueue().catch(console.warn);
    }

    wasOffline = !isOnline;
  });

  return unsubscribe;
}
