import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getApiUrl, queryClient } from "@/lib/query-client";

interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
  subscriptionStatus: "active" | "expired" | "none";
  subscriptionPlan?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  deactivatedAt?: string | null;
  deletionRequestedAt?: string | null;
  deletionStatus?:
    | "none"
    | "requested"
    | "processing"
    | "completed"
    | "rejected";
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ requiresEmailVerification?: boolean } | void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setSessionExpired: (expired: boolean) => void;
  dismissSessionExpired: () => void;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  deactivateAccount: (reason?: string) => Promise<void>;
  requestAccountDeletion: (note?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

async function setToken(key: string, value: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getToken(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

async function removeToken(key: string) {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Save the user's email for login convenience. The password is intentionally
 * NOT persisted for security — only the email is stored.
 * @param email - The user's email address
 * @param _password - Ignored; included for API symmetry only
 */
export async function saveCredentials(email: string, _password: string) {
  // Only save email for convenience. Never store passwords.
  if (Platform.OS === "web") {
    localStorage.setItem("saved_email", email);
  } else {
    await SecureStore.setItemAsync("saved_email", email);
  }
}

/**
 * Retrieve the previously saved email credential.
 * Password is always returned as null (never stored).
 * @returns An object with `email` (string | null) and `password` (always null)
 */
export async function getSavedCredentials() {
  if (Platform.OS === "web") {
    const email = localStorage.getItem("saved_email");
    return { email, password: null };
  } else {
    const email = await SecureStore.getItemAsync("saved_email");
    return { email, password: null };
  }
}

/**
 * Clear all saved credentials from secure/local storage.
 */
export async function clearSavedCredentials() {
  if (Platform.OS === "web") {
    localStorage.removeItem("saved_email");
  } else {
    await SecureStore.deleteItemAsync("saved_email");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getToken(TOKEN_KEY);
      if (token) {
        const baseUrl = getApiUrl();
        const response = await fetch(new URL("/api/auth/me", baseUrl), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          await removeToken(TOKEN_KEY);
          await removeToken(REFRESH_TOKEN_KEY);
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseErrorResponse = async (response: Response) => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const raw = await response.text();
    return { message: raw.trim() || `Request failed (${response.status})` };
  };

  const login = async (email: string, password: string) => {
    const baseUrl = getApiUrl();
    const response = await fetch(new URL("/api/auth/login", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      let error: any = { message: `Login failed (${response.status})` };

      if (contentType.includes("application/json")) {
        error = await response.json();
      } else {
        const raw = await response.text();
        if (raw.includes("<!DOCTYPE html") || raw.includes("<html")) {
          error = {
            message:
              "Login failed due to API endpoint configuration. Please update the app and try again.",
          };
        } else if (raw.trim()) {
          error = { message: raw.trim() };
        }
      }

      throw error; // Return full error object to handle 403 cases
    }

    const data = await response.json();
    await setToken(TOKEN_KEY, data.accessToken);
    if (data.refreshToken) {
      await setToken(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const baseUrl = getApiUrl();
    const url = new URL("/api/auth/register", baseUrl);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    const data = await response.json();

    // If requiresEmailVerification, we don't set user yet
    if (data.requiresEmailVerification) {
      return { requiresEmailVerification: true };
    }

    await setToken(TOKEN_KEY, data.accessToken);
    if (data.refreshToken) {
      await setToken(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    setUser(data.user);
    return {};
  };

  const verifyEmail = async (email: string, code: string) => {
    const baseUrl = getApiUrl();
    const response = await fetch(new URL("/api/auth/verify-email", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Verification failed");
    }

    const data = await response.json();
    await setToken(TOKEN_KEY, data.accessToken);
    setUser(data.user);
  };

  const resendVerificationEmail = async (email: string) => {
    const baseUrl = getApiUrl();
    const response = await fetch(
      new URL("/api/auth/resend-verification", baseUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to resend email");
    }
  };

  const performAccountAction = async (
    route: string,
    payload?: Record<string, string>,
  ) => {
    const token = await getToken(TOKEN_KEY);
    if (!token) {
      throw new Error("You must be signed in to perform this action.");
    }

    const baseUrl = getApiUrl();
    const response = await fetch(new URL(route, baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload ?? {}),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }
  };

  const deactivateAccount = async (reason?: string) => {
    await performAccountAction(
      "/api/user/deactivate",
      reason ? { reason } : undefined,
    );
  };

  const requestAccountDeletion = async (note?: string) => {
    await performAccountAction(
      "/api/user/request-account-deletion",
      note ? { note } : undefined,
    );
  };

  const logout = async () => {
    try {
      const token = await getToken(TOKEN_KEY);
      if (token) {
        const baseUrl = getApiUrl();
        await fetch(new URL("/api/auth/logout", baseUrl), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await removeToken(TOKEN_KEY);
      await removeToken(REFRESH_TOKEN_KEY);
      setUser(null);
      queryClient.clear();
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const dismissSessionExpired = () => {
    setIsSessionExpired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isSessionExpired,
        login,
        register,
        logout,
        refreshUser,
        setSessionExpired: setIsSessionExpired,
        dismissSessionExpired,
        verifyEmail,
        resendVerificationEmail,
        deactivateAccount,
        requestAccountDeletion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * React hook that provides access to the authentication context.
 * Must be called within an {@link AuthProvider}.
 *
 * @returns The full auth context including user, login/logout/register functions,
 *          session-expiry state, and account management actions.
 * @throws Error if called outside of an AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Retrieve the current authentication JWT from secure/local storage.
 * Useful for making authenticated requests outside of React components.
 * @returns The bearer token string, or null if the user is not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  return await getToken(TOKEN_KEY);
}
