import { QueryClient, QueryFunction } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

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
  return process.env.EXPO_PUBLIC_API_URL || "https://maternalmind.com.pk";
}

// Refresh lock to prevent concurrent refresh requests
let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
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

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
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
      });
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
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
