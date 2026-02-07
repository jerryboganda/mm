import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiRequest, getApiUrl, queryClient } from "@/lib/query-client";

interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
  subscriptionStatus: "active" | "expired" | "none";
  subscriptionPlan?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
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
  sendPhoneOtp: (phoneNumber: string) => Promise<void>;
  verifyPhoneOtp: (code: string) => Promise<void>;
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

export async function saveCredentials(email: string, _password: string) {
  // Only save email for convenience. Never store passwords.
  if (Platform.OS === "web") {
    localStorage.setItem("saved_email", email);
  } else {
    await SecureStore.setItemAsync("saved_email", email);
  }
}

export async function getSavedCredentials() {
  if (Platform.OS === "web") {
    const email = localStorage.getItem("saved_email");
    return { email, password: null };
  } else {
    const email = await SecureStore.getItemAsync("saved_email");
    return { email, password: null };
  }
}

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

  const login = async (email: string, password: string) => {
    const baseUrl = getApiUrl();
    const response = await fetch(new URL("/api/auth/login", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
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
    const response = await fetch(new URL("/api/auth/resend-verification", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to resend email");
    }
  };

  const sendPhoneOtp = async (phoneNumber: string) => {
    const baseUrl = getApiUrl();
    const token = await getToken(TOKEN_KEY);

    const response = await fetch(new URL("/api/auth/send-phone-otp", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ phoneNumber }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send OTP");
    }
  };

  const verifyPhoneOtp = async (code: string) => {
    const baseUrl = getApiUrl();
    const token = await getToken(TOKEN_KEY);
    const response = await fetch(new URL("/api/auth/verify-phone-otp", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Verification failed");
    }

    // Refresh user to get updated verification status
    await checkAuth();
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
        sendPhoneOtp,
        verifyPhoneOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export async function getAuthToken(): Promise<string | null> {
  return await getToken(TOKEN_KEY);
}
