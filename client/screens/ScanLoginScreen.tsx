import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassInput } from "@/components/GlassInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type ScanLoginNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ScanLogin"
>;

interface ScanLoginSettings {
  enabled: boolean;
  title: string;
  instructions: string;
  buttonText: string;
}

const DEFAULT_SETTINGS: ScanLoginSettings = {
  enabled: true,
  title: "Scan to login",
  instructions:
    "Scan the QR code or enter the printed access code provided by Maternal Mind.",
  buttonText: "Scan to login",
};

function extractCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.code === "string") {
      return parsed.code;
    }
  } catch {
    // Plain printed codes are expected.
  }

  try {
    const url = new URL(trimmed);
    return (
      url.searchParams.get("code") ||
      url.searchParams.get("loginCode") ||
      trimmed
    );
  } catch {
    return trimmed;
  }
}

export default function ScanLoginScreen() {
  const navigation = useNavigation<ScanLoginNavigationProp>();
  const { scanLogin } = useAuth();
  const { theme, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [settings, setSettings] = useState<ScanLoginSettings>(DEFAULT_SETTINGS);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(
          new URL("/api/auth/scan-login-settings", getApiUrl()),
        );
        if (response.ok) {
          const data = await response.json();
          setSettings({
            enabled: Boolean(data.enabled),
            title: data.title || DEFAULT_SETTINGS.title,
            instructions: data.instructions || DEFAULT_SETTINGS.instructions,
            buttonText: data.buttonText || DEFAULT_SETTINGS.buttonText,
          });
        }
      } catch {
        // Defaults keep the manual fallback usable if settings cannot load.
      }
    };
    loadSettings();
  }, []);

  const cameraReady = useMemo(() => permission?.granted === true, [permission]);

  const submitCode = async (rawCode: string) => {
    const code = extractCode(rawCode);
    if (!code) {
      Alert.alert("Code Required", "Please scan or enter your access code.");
      return;
    }

    setLoading(true);
    try {
      await scanLogin(code);
    } catch (error: any) {
      setScanned(false);
      Alert.alert(
        "Scan Login Failed",
        error?.message || "Please check the code and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleScan = ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    submitCode(data);
  };

  const handlePermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        "Camera Permission Needed",
        "Camera access is required to scan a login QR code. You can still enter the code manually.",
      );
    }
  };

  return (
    <BackgroundGradient variant="auth">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { borderColor: theme.glassBorder }]}
            accessibilityRole="button"
            accessibilityLabel="Back to login"
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <ThemedText type="h2">{settings.title}</ThemedText>
            <ThemedText
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              {settings.instructions}
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.scannerCard,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.6)",
              borderColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.05)",
            },
          ]}
        >
          {settings.enabled && cameraReady ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleScan}
            />
          ) : (
            <View style={styles.permissionPanel}>
              <Ionicons
                name="qr-code-outline"
                size={54}
                color={theme.primary}
              />
              <ThemedText style={styles.permissionTitle}>
                {settings.enabled ? "Camera scanner" : "Scan login unavailable"}
              </ThemedText>
              <ThemedText
                style={[styles.permissionText, { color: theme.textSecondary }]}
              >
                {settings.enabled
                  ? "Allow camera access to scan your printed QR code."
                  : "Scan login is currently disabled. You can return to normal sign in."}
              </ThemedText>
              {settings.enabled ? (
                <PrimaryButton
                  title="Allow Camera"
                  onPress={handlePermission}
                  icon="camera"
                  style={styles.permissionButton}
                />
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.manualPanel}>
          <GlassInput
            label="Access Code"
            icon="key"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Access code"
          />
          <PrimaryButton
            title="Verify Code"
            onPress={() => submitCode(manualCode)}
            loading={loading}
            icon="check-circle"
            style={styles.verifyButton}
          />
        </View>
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing["5xl"],
    paddingBottom: Spacing["3xl"],
  },
  header: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
    marginBottom: Spacing["2xl"],
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: 14,
    lineHeight: 20,
  },
  scannerCard: {
    height: 320,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  permissionPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  permissionTitle: {
    marginTop: Spacing.md,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  permissionText: {
    marginTop: Spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: Spacing.xl,
    minWidth: 180,
  },
  manualPanel: {
    marginTop: Spacing["2xl"],
  },
  verifyButton: {
    marginTop: Spacing.lg,
  },
});
