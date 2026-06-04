import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "device_id";

function createDeviceId(): string {
  const randomValue =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `mm-${randomValue}`;
}

async function getStoredDeviceId(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(DEVICE_ID_KEY);
  }
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}

async function setStoredDeviceId(deviceId: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return;
  }
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
}

export async function getDeviceIdentity() {
  let deviceId = await getStoredDeviceId();
  if (!deviceId) {
    deviceId = createDeviceId();
    await setStoredDeviceId(deviceId);
  }

  return {
    deviceId,
    platform: Platform.OS,
    deviceLabel:
      Platform.OS === "web"
        ? "Web browser"
        : Platform.OS === "ios"
          ? "iOS device"
          : Platform.OS === "android"
            ? "Android device"
            : "Device",
  };
}
