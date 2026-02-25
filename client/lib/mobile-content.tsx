import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { Alert, AlertButton } from "react-native";

interface MobileAppContentPayload {
  textOverrides: Record<string, string>;
  updatedAt: string | null;
}

interface MobileContentContextValue {
  textOverrides: Record<string, string>;
  resolveText: (value: string) => string;
  isLoading: boolean;
  updatedAt: string | null;
}

type AlertFn = typeof Alert.alert;
const nativeAlert: AlertFn = Alert.alert;

const MobileContentContext = createContext<MobileContentContextValue>({
  textOverrides: {},
  resolveText: (value: string) => value,
  isLoading: false,
  updatedAt: null,
});

export function MobileContentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, isLoading } = useQuery<MobileAppContentPayload>({
    queryKey: ["/api/mobile-content"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/mobile-content");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchInterval: 30_000,
  });

  const textOverrides = data?.textOverrides || {};
  const updatedAt = data?.updatedAt || null;

  const value = useMemo<MobileContentContextValue>(() => {
    const resolveText = (input: string): string => {
      if (typeof input !== "string") return input;

      if (Object.prototype.hasOwnProperty.call(textOverrides, input)) {
        const direct = textOverrides[input];
        if (typeof direct === "string" && direct.length > 0) return direct;
      }

      const trimmed = input.trim();
      if (trimmed && Object.prototype.hasOwnProperty.call(textOverrides, trimmed)) {
        const normalized = textOverrides[trimmed];
        if (typeof normalized === "string" && normalized.length > 0) {
          return normalized;
        }
      }

      return input;
    };

    return {
      textOverrides,
      resolveText,
      isLoading,
      updatedAt,
    };
  }, [isLoading, textOverrides, updatedAt]);

  React.useEffect(() => {
    const patchedAlert: AlertFn = (title, message, buttons, options) => {
      const resolvedTitle =
        typeof title === "string" ? value.resolveText(title) : title;
      const resolvedMessage =
        typeof message === "string" ? value.resolveText(message) : message;
      const resolvedButtons = buttons?.map((button: AlertButton) => ({
        ...button,
        text:
          typeof button.text === "string"
            ? value.resolveText(button.text)
            : button.text,
      }));

      return nativeAlert(resolvedTitle, resolvedMessage, resolvedButtons, options);
    };

    Alert.alert = patchedAlert;
    return () => {
      Alert.alert = nativeAlert;
    };
  }, [value]);

  return (
    <MobileContentContext.Provider value={value}>
      {children}
    </MobileContentContext.Provider>
  );
}

export function useMobileContent() {
  return useContext(MobileContentContext);
}
