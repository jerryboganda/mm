export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.maternalmind.app";
export const PLAY_STORE_MARKET_URL =
  "market://details?id=com.maternalmind.app";
export const ANDROID_APK_URL = "/downloads/maternal-mind-v1.0.apk";
export const IOS_PACKAGE_URL = "/downloads/maternal-mind-v1.0.ipa";

export function getAppDownloadUrl(): string {
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod/i.test(ua)) {
      return "/download";
    }
  }
  // Official Google Play Store listing for Android and desktop
  return PLAY_STORE_URL;
}

export function openAppDownload(): void {
  if (typeof window === "undefined") return;

  const ua = window.navigator?.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  if (isIOS) {
    // Navigate iOS users to dedicated download hub for iOS instructions
    window.location.href = "/download";
  } else {
    // Open official Google Play Store page in new tab/app store
    window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer");
  }
}
