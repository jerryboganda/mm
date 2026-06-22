import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Save,
  RefreshCw,
  Smartphone,
  QrCode,
  Image,
} from "lucide-react";
import { api } from "../lib/api";

interface ReaderWatermarkSettings {
  enabled: boolean;
  opacity: number;
}

interface MobileAppContentResponse {
  textOverrides: Record<string, string>;
  readerWatermark: ReaderWatermarkSettings;
  updatedAt: string | null;
}

interface SupportContactSettings {
  whatsappNumber: string;
  phoneNumber: string;
  supportEmail: string;
  whatsappDefaultMessage: string;
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  emailEnabled: boolean;
}

interface ScanLoginSettings {
  enabled: boolean;
  targetEmail: string;
  title: string;
  instructions: string;
  buttonText: string;
  hasCode: boolean;
}

const EXAMPLE_OVERRIDES = {
  "Welcome Back": "Welcome to Maternal Mind",
  "Help & Support": "Help Center",
  "I Understand & Continue": "I Understand and Continue",
};

export default function MobileAppContentPage() {
  const [rawJson, setRawJson] = useState<string>("{}");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [readerWatermark, setReaderWatermark] =
    useState<ReaderWatermarkSettings>({
      enabled: true,
      opacity: 0.06,
    });
  const [supportContact, setSupportContact] = useState<SupportContactSettings>({
    whatsappNumber: "",
    phoneNumber: "",
    supportEmail: "",
    whatsappDefaultMessage: "",
    whatsappEnabled: false,
    phoneEnabled: false,
    emailEnabled: true,
  });
  const [savingSupport, setSavingSupport] = useState(false);
  const [scanLogin, setScanLogin] = useState<ScanLoginSettings>({
    enabled: false,
    targetEmail: "",
    title: "Scan to login",
    instructions:
      "Scan the QR code or enter the printed access code provided by Maternal Mind.",
    buttonText: "Scan to login",
    hasCode: false,
  });
  const [scanLoginCode, setScanLoginCode] = useState("");
  const [savingScanLogin, setSavingScanLogin] = useState(false);

  const entryCount = useMemo(() => {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return 0;
      }
      return Object.keys(parsed).length;
    } catch {
      return 0;
    }
  }, [rawJson]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [data, support, scanSettings] = await Promise.all([
        api.get<MobileAppContentResponse>("/admin/mobile-app-content"),
        api.get<SupportContactSettings>("/admin/support-contact").catch(() => ({
          whatsappNumber: "",
          phoneNumber: "",
          supportEmail: "",
          whatsappDefaultMessage: "",
          whatsappEnabled: false,
          phoneEnabled: false,
          emailEnabled: true,
        })),
        api.get<ScanLoginSettings>("/admin/scan-login-settings").catch(() => ({
          enabled: false,
          targetEmail: "",
          title: "Scan to login",
          instructions:
            "Scan the QR code or enter the printed access code provided by Maternal Mind.",
          buttonText: "Scan to login",
          hasCode: false,
        })),
      ]);
      setRawJson(JSON.stringify(data.textOverrides || {}, null, 2));
      setReaderWatermark(
        data.readerWatermark || {
          enabled: true,
          opacity: 0.06,
        },
      );
      setUpdatedAt(data.updatedAt);
      setSupportContact(support);
      setScanLogin(scanSettings);
      setScanLoginCode("");
    } catch (e: any) {
      setError(e?.message || "Failed to load mobile app content.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error('JSON must be an object of { "original": "updated" }.');
      }

      const textOverrides: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string") continue;
        const normalizedKey = key.trim();
        if (!normalizedKey) continue;
        textOverrides[normalizedKey] = value;
      }

      const result = await api.put<MobileAppContentResponse>(
        "/admin/mobile-app-content",
        { textOverrides, readerWatermark },
      );

      setRawJson(JSON.stringify(result.textOverrides || {}, null, 2));
      setReaderWatermark(
        result.readerWatermark || {
          enabled: true,
          opacity: 0.06,
        },
      );
      setUpdatedAt(result.updatedAt);
      setMessage("Mobile app content saved successfully.");
      setTimeout(() => setMessage(""), 4000);
    } catch (e: any) {
      setError(e?.message || "Failed to save mobile app content.");
    } finally {
      setSaving(false);
    }
  };

  const saveSupportContact = async () => {
    setSavingSupport(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.put<SupportContactSettings>(
        "/admin/support-contact",
        supportContact,
      );
      setSupportContact(updated);
      setMessage("Support contact settings saved successfully.");
      setTimeout(() => setMessage(""), 4000);
    } catch (e: any) {
      setError(e?.message || "Failed to save support contact settings.");
    } finally {
      setSavingSupport(false);
    }
  };

  const saveScanLogin = async () => {
    setSavingScanLogin(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.put<ScanLoginSettings>(
        "/admin/scan-login-settings",
        {
          ...scanLogin,
          code: scanLoginCode,
        },
      );
      setScanLogin(updated);
      setScanLoginCode("");
      setMessage("Scan login settings saved successfully.");
      setTimeout(() => setMessage(""), 4000);
    } catch (e: any) {
      setError(e?.message || "Failed to save scan login settings.");
    } finally {
      setSavingScanLogin(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content</h1>
        <p className="text-gray-500 mt-1">Mobile App Content</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Text Overrides
          </h2>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Add overrides as JSON where the key is the exact original app text and
          the value is the replacement shown instantly in the mobile app without
          a new build.
        </p>

        <div className="text-xs text-gray-500 mb-4 space-y-1">
          <p>Entries: {entryCount}</p>
          {updatedAt ? (
            <p>Last updated: {new Date(updatedAt).toLocaleString()}</p>
          ) : null}
        </div>

        <textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          className="w-full min-h-[420px] border border-gray-200 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
          spellCheck={false}
        />

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Content"}
          </button>

          <button
            onClick={load}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-all text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        </div>

        {message ? (
          <p className="text-sm text-emerald-600 mt-3">{message}</p>
        ) : null}
        {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Reader Watermark
          </h2>
        </div>

        <div className="space-y-5">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={readerWatermark.enabled}
              onChange={(e) =>
                setReaderWatermark((prev) => ({
                  ...prev,
                  enabled: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            Show faint official logo behind course reading text
          </label>

          <div>
            <div className="flex items-center justify-between gap-4 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Opacity
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  value={Math.round(readerWatermark.opacity * 100)}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    const clamped = Number.isFinite(value)
                      ? Math.min(20, Math.max(0, value))
                      : 6;
                    setReaderWatermark((prev) => ({
                      ...prev,
                      opacity: clamped / 100,
                    }));
                  }}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={Math.round(readerWatermark.opacity * 100)}
              onChange={(e) =>
                setReaderWatermark((prev) => ({
                  ...prev,
                  opacity: Number(e.target.value) / 100,
                }))
              }
              className="w-full accent-primary-500"
              disabled={!readerWatermark.enabled}
            />

            <p className="text-xs text-gray-500 mt-2">
              Maximum is capped at 20% so the logo stays behind the reading text
              without reducing readability.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          Example JSON
        </h3>
        <pre className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-3 overflow-auto">
          {JSON.stringify(EXAMPLE_OVERRIDES, null, 2)}
        </pre>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Support Contact
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex flex-wrap gap-4">
            {[
              ["emailEnabled", "Email"],
              ["phoneEnabled", "Phone"],
              ["whatsappEnabled", "WhatsApp"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={Boolean(
                    supportContact[key as keyof SupportContactSettings],
                  )}
                  onChange={(e) =>
                    setSupportContact((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                {label}
              </label>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Support Email
            </label>
            <input
              value={supportContact.supportEmail}
              onChange={(e) =>
                setSupportContact((prev) => ({
                  ...prev,
                  supportEmail: e.target.value,
                }))
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder="maternalmind.help@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              value={supportContact.phoneNumber}
              onChange={(e) =>
                setSupportContact((prev) => ({
                  ...prev,
                  phoneNumber: e.target.value,
                }))
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder="+92 300 1234567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp Number
            </label>
            <input
              value={supportContact.whatsappNumber}
              onChange={(e) =>
                setSupportContact((prev) => ({
                  ...prev,
                  whatsappNumber: e.target.value,
                }))
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder="+92 300 1234567"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp Default Message
            </label>
            <textarea
              value={supportContact.whatsappDefaultMessage}
              onChange={(e) =>
                setSupportContact((prev) => ({
                  ...prev,
                  whatsappDefaultMessage: e.target.value,
                }))
              }
              className="w-full min-h-[100px] border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder="Hello Support Team, I need help."
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={saveSupportContact}
            disabled={savingSupport}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium"
          >
            {savingSupport ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savingSupport ? "Saving..." : "Save Support Contact"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-gray-900">Scan Login</h2>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input
            id="scan-login-enabled"
            type="checkbox"
            checked={scanLogin.enabled}
            onChange={(e) =>
              setScanLogin((prev) => ({ ...prev, enabled: e.target.checked }))
            }
            className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          <label
            htmlFor="scan-login-enabled"
            className="text-sm font-medium text-gray-700"
          >
            Enable printed QR/manual code login
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Account Email
            </label>
            <input
              value={scanLogin.targetEmail}
              onChange={(e) =>
                setScanLogin((prev) => ({
                  ...prev,
                  targetEmail: e.target.value,
                }))
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder="student@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Access Code
            </label>
            <input
              value={scanLoginCode}
              onChange={(e) => setScanLoginCode(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder={
                scanLogin.hasCode
                  ? "Leave blank to keep current code"
                  : "Enter printed code"
              }
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              {scanLogin.hasCode
                ? "A code is configured. Enter a new code only when rotating it."
                : "No access code is configured yet."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Login Title
            </label>
            <input
              value={scanLogin.title}
              onChange={(e) =>
                setScanLogin((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder="Scan to login"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Button Text
            </label>
            <input
              value={scanLogin.buttonText}
              onChange={(e) =>
                setScanLogin((prev) => ({
                  ...prev,
                  buttonText: e.target.value,
                }))
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder="Scan to login"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions
            </label>
            <textarea
              value={scanLogin.instructions}
              onChange={(e) =>
                setScanLogin((prev) => ({
                  ...prev,
                  instructions: e.target.value,
                }))
              }
              className="w-full min-h-[100px] border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              placeholder="Scan the QR code or enter the printed access code."
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={saveScanLogin}
            disabled={savingScanLogin}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium"
          >
            {savingScanLogin ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savingScanLogin ? "Saving..." : "Save Scan Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
