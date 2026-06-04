import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api } from "../lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const ADMIN_DEVICE_ID_KEY = "admin_device_id";

function getAdminDeviceIdentity() {
  let deviceId = localStorage.getItem(ADMIN_DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `admin-${crypto.randomUUID()}`
        : `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(ADMIN_DEVICE_ID_KEY, deviceId);
  }

  return {
    deviceId,
    platform: "web",
    deviceLabel: "Admin web browser",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.get<User>("/auth/me");
      if (data.role !== "admin") {
        throw new Error("Access denied");
      }
      setUser(data);
    } catch {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ accessToken: string; user: User }>(
      "/auth/login",
      {
        email,
        password,
        ...getAdminDeviceIdentity(),
      },
    );

    if (data.user.role !== "admin") {
      throw new Error("Access denied. Admin privileges required.");
    }

    localStorage.setItem("admin_token", data.accessToken);
    localStorage.setItem("admin_user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local cleanup still needs to run when the server session is already gone.
    } finally {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
