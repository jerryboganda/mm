const IOS_APP_URL = "https://apps.apple.com/app/id982107779";
const ANDROID_APP_URL =
  "https://play.google.com/store/apps/details?id=host.exp.exponent";

export function getAppDownloadUrl(): string {
  if (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)) {
    return ANDROID_APP_URL;
  }
  return IOS_APP_URL;
}

export function openAppDownload(): void {
  const targetUrl = getAppDownloadUrl();
  window.open(targetUrl, "_blank", "noopener,noreferrer");
}
