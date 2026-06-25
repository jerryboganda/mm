import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Loader2,
  Mail,
  Save,
  FileText,
  Clock,
  Shield,
  CreditCard,
  Plus,
  Trash2,
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  adminUserId?: string;
  adminName?: string;
}

interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<
    "email" | "payments" | "devices" | "audit"
  >("email");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Platform configuration & activity logs
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("email")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "email" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <span className="flex items-center gap-2">
            <Mail className="w-4 h-4" /> Email
          </span>
        </button>
        <button
          onClick={() => setTab("payments")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "payments" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <span className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Payments
          </span>
        </button>
        <button
          onClick={() => setTab("devices")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "devices" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Device Limits
          </span>
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "audit" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Audit Log
          </span>
        </button>
      </div>

      {tab === "email" ? (
        <EmailSettingsTab />
      ) : tab === "payments" ? (
        <PaymentSettingsTab />
      ) : tab === "devices" ? (
        <DeviceLimitSettingsTab />
      ) : (
        <AuditLogTab />
      )}
    </div>
  );
}

interface Wallet {
  name: string;
  accountTitle: string;
  number: string;
}

interface PaymentInstructions {
  currency: string;
  instructions: string;
  bank: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
  };
  wallets: Wallet[];
}

const EMPTY_PAYMENT: PaymentInstructions = {
  currency: "PKR",
  instructions: "",
  bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" },
  wallets: [],
};

function PaymentSettingsTab() {
  const [form, setForm] = useState<PaymentInstructions>(EMPTY_PAYMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api
      .get<{ instructions: PaymentInstructions }>(
        "/admin/manual-payments/payment-settings",
      )
      .then((r) => setForm({ ...EMPTY_PAYMENT, ...r.instructions }))
      .catch(() => setMsg("Failed to load payment settings"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const r = await api.put<{ instructions: PaymentInstructions }>(
        "/admin/manual-payments/payment-settings",
        form,
      );
      setForm({ ...EMPTY_PAYMENT, ...r.instructions });
      setMsg("Payment settings saved ✓");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      console.error(e);
      setMsg("Failed to save payment settings");
    } finally {
      setSaving(false);
    }
  };

  const setBank = (key: keyof PaymentInstructions["bank"], value: string) =>
    setForm((f) => ({ ...f, bank: { ...f.bank, [key]: value } }));

  const setWallet = (i: number, key: keyof Wallet, value: string) =>
    setForm((f) => ({
      ...f,
      wallets: f.wallets.map((w, idx) =>
        idx === i ? { ...w, [key]: value } : w,
      ),
    }));

  const addWallet = () =>
    setForm((f) => ({
      ...f,
      wallets: [...f.wallets, { name: "", accountTitle: "", number: "" }],
    }));

  const removeWallet = (i: number) =>
    setForm((f) => ({ ...f, wallets: f.wallets.filter((_, idx) => idx !== i) }));

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-primary-500" />
        <h2 className="text-lg font-semibold text-gray-900">
          Manual Payment Details
        </h2>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Shown to users on the purchase screen. They transfer payment here, then
        upload proof for your review.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Currency
        </label>
        <input
          className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Instructions
        </label>
        <textarea
          className={inputCls}
          rows={3}
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          placeholder="e.g. Transfer the package amount and upload your receipt."
        />
      </div>

      {/* Bank */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Bank Account</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bank Name</label>
            <input
              className={inputCls}
              value={form.bank.bankName}
              onChange={(e) => setBank("bankName", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Account Title
            </label>
            <input
              className={inputCls}
              value={form.bank.accountTitle}
              onChange={(e) => setBank("accountTitle", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Account Number
            </label>
            <input
              className={inputCls}
              value={form.bank.accountNumber}
              onChange={(e) => setBank("accountNumber", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">IBAN</label>
            <input
              className={inputCls}
              value={form.bank.iban}
              onChange={(e) => setBank("iban", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Wallets */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Mobile Wallets
          </h3>
          <button
            onClick={addWallet}
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="w-4 h-4" /> Add wallet
          </button>
        </div>
        {form.wallets.length === 0 ? (
          <p className="text-xs text-gray-400">
            No wallets added (e.g. JazzCash, Easypaisa).
          </p>
        ) : (
          form.wallets.map((w, i) => (
            <div
              key={i}
              className="grid grid-cols-3 gap-3 items-end border-b border-gray-50 pb-3"
            >
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Wallet
                </label>
                <input
                  className={inputCls}
                  placeholder="JazzCash"
                  value={w.name}
                  onChange={(e) => setWallet(i, "name", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Account Title
                </label>
                <input
                  className={inputCls}
                  value={w.accountTitle}
                  onChange={(e) => setWallet(i, "accountTitle", e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">
                    Number
                  </label>
                  <input
                    className={inputCls}
                    value={w.number}
                    onChange={(e) => setWallet(i, "number", e.target.value)}
                  />
                </div>
                <button
                  onClick={() => removeWallet(i)}
                  className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-4">
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
          {saving ? "Saving..." : "Save Payment Settings"}
        </button>
        {msg && <span className="text-sm text-gray-600 font-medium">{msg}</span>}
      </div>
    </div>
  );
}

interface DeviceLimitSettings {
  enabled: boolean;
  defaultMax: number;
}

function DeviceLimitSettingsTab() {
  const [form, setForm] = useState<DeviceLimitSettings>({
    enabled: false,
    defaultMax: 3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api
      .get<DeviceLimitSettings>("/admin/device-limits/settings")
      .then((settings) => setForm(settings))
      .catch(() => setMsg("Failed to load device limit settings"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const updated = await api.put<DeviceLimitSettings>(
        "/admin/device-limits/settings",
        {
          enabled: form.enabled,
          defaultMax: Math.min(20, Math.max(1, Number(form.defaultMax) || 3)),
        },
      );
      setForm(updated);
      setMsg("Device limit settings saved");
      setTimeout(() => setMsg(""), 3000);
    } catch (error) {
      console.error(error);
      setMsg("Failed to save device limit settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-5 h-5 text-primary-500" />
        <h2 className="text-lg font-semibold text-gray-900">
          Device Login Limits
        </h2>
      </div>

      <div className="space-y-5">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          Enable global device limit for users without a custom override
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Max Devices
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={form.defaultMax}
            onChange={(e) =>
              setForm({ ...form, defaultMax: Number(e.target.value) })
            }
            className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-2">
            New logins are allowed. If the account is over its limit, the oldest
            active device is signed out automatically.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-6">
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
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {msg && (
          <span className="text-sm text-gray-600 font-medium">{msg}</span>
        )}
      </div>
    </div>
  );
}

function EmailSettingsTab() {
  const [form, setForm] = useState<EmailSettings>({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    fromEmail: "",
    fromName: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api
      .get<EmailSettings>("/admin/email-settings")
      .then((s) => setForm(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/email-settings", form);
      setMsg("Settings saved ✓");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      console.error(e);
      setMsg("Failed to save");
    }
    setSaving(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  const field = (label: string, key: keyof EmailSettings, type = "text") => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) =>
          setForm({
            ...form,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          })
        }
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="w-5 h-5 text-primary-500" />
        <h2 className="text-lg font-semibold text-gray-900">
          SMTP / Email Settings
        </h2>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {field("SMTP Host", "smtpHost")}
          {field("SMTP Port", "smtpPort", "number")}
        </div>
        {field("SMTP User / Email", "smtpUser")}
        {field("SMTP Password", "smtpPass", "password")}
        <div className="grid grid-cols-2 gap-4">
          {field("From Email", "fromEmail")}
          {field("From Name", "fromName")}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Settings"}
        </button>
        {msg && (
          <span className="text-sm text-emerald-600 font-medium">{msg}</span>
        )}
      </div>
    </div>
  );
}

function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 25;

  useEffect(() => {
    setLoading(true);
    api
      .get<{ data: AuditLog[]; total: number }>(
        `/admin/analytics/audit-logs?page=${page}&limit=${perPage}`,
      )
      .then((r) => {
        setLogs(r.data);
        setTotal(r.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / perPage);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
        <span className="text-xs text-gray-400 ml-2">{total} entries</span>
      </div>

      {logs.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No audit entries yet.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {logs.map((l) => (
              <div key={l.id} className="py-3 flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">
                      {l.adminName || "Admin"}
                    </span>{" "}
                    <span className="text-gray-500">{l.action}</span>{" "}
                    <span className="text-gray-600">
                      {l.entityType}
                      {l.entityId ? ` #${l.entityId}` : ""}
                    </span>
                  </p>
                  {l.details && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {JSON.stringify(l.details)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
