import {
  QueryClient,
  QueryFunction,
  onlineManager,
} from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const DEFAULT_PROD_API_ORIGIN = "https://maternalmind.com.pk";

function getHostedWebApiOrigin(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  const { hostname, origin } = window.location;
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  // Local dev: use configured EXPO_PUBLIC_API_URL (usually a different port).
  if (isLocalHost) {
    return null;
  }

  // Any hosted web deployment (maternalmind.com.pk, admin.maternalmind.com.pk, etc.)
  // serves the Express API from its own origin under Single-Slot architecture.
  return origin;
}

// ── Wire TanStack Query's onlineManager to NetInfo ──────────────
// When offline: queries serve from cache, mutations are paused.
// When back online: stale queries refetch, paused mutations execute.
onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const online = !!(state.isConnected && state.isInternetReachable !== false);
    setOnline(online);
  });
  return unsubscribe;
});

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  } else {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  }
}

async function setToken(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function removeToken(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  const hostedWebOrigin = getHostedWebApiOrigin();
  if (hostedWebOrigin) {
    return hostedWebOrigin;
  }

  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configured) {
    return DEFAULT_PROD_API_ORIGIN;
  }

  try {
    const parsed = new URL(configured);
    return parsed.origin;
  } catch {
    // Invalid URL in env: fall back to known-good production API host.
    return DEFAULT_PROD_API_ORIGIN;
  }
}

// Refresh lock to prevent concurrent refresh requests
let refreshPromise: Promise<string | null> | null = null;

export async function attemptTokenRefresh(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken =
        Platform.OS === "web"
          ? localStorage.getItem(REFRESH_TOKEN_KEY)
          : await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      if (!refreshToken) return null;

      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/auth/refresh", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        // Refresh token is invalid — clear everything
        await removeToken(TOKEN_KEY);
        await removeToken(REFRESH_TOKEN_KEY);
        return null;
      }

      const data = await res.json();
      await setToken(TOKEN_KEY, data.accessToken);
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Make an authenticated API request to the backend.
 * Automatically attaches the bearer token and retries once on 401 via token refresh.
 *
 * @param method - HTTP method (e.g. "GET", "POST", "PATCH", "DELETE")
 * @param route - The API route path (e.g. "/api/books")
 * @param data - Optional request body. Will be JSON-serialized.
 * @returns The fetch Response object
 * @throws Error if the response status is not ok (after potential token refresh)
 */
export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  let token = await getToken();

  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    let res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal,
    });

    // Auto-refresh on 401
    if (res.status === 401 && token) {
      const newToken = await attemptTokenRefresh();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
          signal: controller.signal,
        });
      }
    }

    await throwIfResNotOk(res);
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Upload multipart/form-data (e.g. an image) to the backend with auth.
 * Does NOT set Content-Type so the platform sets the multipart boundary.
 * Retries once on 401 via token refresh. Returns the parsed JSON body.
 *
 * @param route - The API route path (e.g. "/api/subscriptions/proof")
 * @param formData - A FormData instance containing the file + fields
 */
export async function apiUpload<T = unknown>(
  route: string,
  formData: FormData,
): Promise<T> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  let token = await getToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    let res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
      signal: controller.signal,
    });

    if (res.status === 401 && token) {
      const newToken = await attemptTokenRefresh();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, {
          method: "POST",
          headers,
          body: formData,
          credentials: "include",
          signal: controller.signal,
        });
      }
    }

    await throwIfResNotOk(res);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Factory that creates a TanStack Query `queryFn` with configurable 401 handling.
 * The returned function builds the URL from `queryKey` segments, attaches auth headers,
 * and automatically attempts a token refresh on 401.
 *
 * @typeParam T - The expected JSON response type
 * @param options - Configuration object
 * @param options.on401 - How to handle 401 responses: "returnNull" returns null, "throw" raises an error
 * @returns A `QueryFunction<T>` suitable for use with `useQuery` or as a default query function
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const path = queryKey[0] as string;
    const url = new URL(path, baseUrl);

    if (queryKey.length > 1) {
      for (let i = 1; i < queryKey.length; i++) {
        const segment = queryKey[i];
        if (segment !== undefined && segment !== null) {
          url.pathname = url.pathname + "/" + String(segment);
        }
      }
    }

    let token = await getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let res = await fetch(url, {
      credentials: "include",
      headers,
    });

    // Auto-refresh on 401
    if (res.status === 401 && token) {
      const newToken = await attemptTokenRefresh();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, {
          credentials: "include",
          headers,
        });
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry auth errors or client errors
        const message = (error as Error)?.message || "";
        if (
          message.startsWith("401:") ||
          message.startsWith("403:") ||
          message.startsWith("404:") ||
          message.startsWith("422:")
        ) {
          return false;
        }
        // Retry server errors and network errors up to 3 times
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
    mutations: {
      retry: false,
    },
  },
});
