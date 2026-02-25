import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, RefreshCw, Smartphone } from "lucide-react";
import { api } from "../lib/api";

interface MobileAppContentResponse {
  textOverrides: Record<string, string>;
  updatedAt: string | null;
}

interface SupportContactSettings {
  whatsappNumber: string;
  phoneNumber: string;
  supportEmail: string;
  whatsappDefaultMessage: string;
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
  const [supportContact, setSupportContact] = useState<SupportContactSettings>({
    whatsappNumber: "",
    phoneNumber: "",
    supportEmail: "",
    whatsappDefaultMessage: "",
  });
  const [savingSupport, setSavingSupport] = useState(false);

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
      const [data, support] = await Promise.all([
        api.get<MobileAppContentResponse>("/admin/mobile-app-content"),
        api
          .get<SupportContactSettings>("/admin/support-contact")
          .catch(() => ({
            whatsappNumber: "",
            phoneNumber: "",
            supportEmail: "",
            whatsappDefaultMessage: "",
          })),
      ]);
      setRawJson(JSON.stringify(data.textOverrides || {}, null, 2));
      setUpdatedAt(data.updatedAt);
      setSupportContact(support);
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
        throw new Error("JSON must be an object of { \"original\": \"updated\" }.");
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
        { textOverrides },
      );

      setRawJson(JSON.stringify(result.textOverrides || {}, null, 2));
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
          <h2 className="text-lg font-semibold text-gray-900">Text Overrides</h2>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Add overrides as JSON where the key is the exact original app text and the
          value is the replacement shown instantly in the mobile app without a new
          build.
        </p>

        <div className="text-xs text-gray-500 mb-4 space-y-1">
          <p>Entries: {entryCount}</p>
          {updatedAt ? <p>Last updated: {new Date(updatedAt).toLocaleString()}</p> : null}
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

        {message ? <p className="text-sm text-emerald-600 mt-3">{message}</p> : null}
        {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Example JSON</h3>
        <pre className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-3 overflow-auto">
{JSON.stringify(EXAMPLE_OVERRIDES, null, 2)}
        </pre>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-gray-900">Support Contact</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              placeholder="support@maternalmind.com.pk"
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
    </div>
  );
}
