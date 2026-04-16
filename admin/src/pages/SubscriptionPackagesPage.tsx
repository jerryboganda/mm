import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Plus,
  Pencil,
  Archive,
  Loader2,
  Package,
  X,
  AlertCircle,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ListChecks,
  Eye,
  EyeOff,
} from "lucide-react";

/* ─── Types ─── */

interface PackageFeature {
  id?: string;
  key: string;
  label: string;
  included: boolean;
  sortOrder: number;
}

interface PackagePrice {
  id?: string;
  billingCycle: string;
  price: number;
  currency: string;
  stripePriceId: string;
  isActive: boolean;
}

interface SubscriptionPackage {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: "active" | "inactive" | "archived";
  displayOrder: number;
  subscriberCount: number;
  features: PackageFeature[];
  prices: PackagePrice[];
  createdAt: string;
  updatedAt: string;
}

type PackageStatus = "active" | "inactive" | "archived";

const STATUS_STYLES: Record<PackageStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

const BILLING_CYCLES = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
] as const;
const BILLING_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
};

const emptyForm = () => ({
  name: "",
  slug: "",
  description: "",
  status: "active" as PackageStatus,
  displayOrder: 0,
});

const emptyFeature = (): PackageFeature => ({
  key: "",
  label: "",
  included: true,
  sortOrder: 0,
});

const emptyPrice = (): PackagePrice => ({
  billingCycle: "monthly",
  price: 0,
  currency: "USD",
  stripePriceId: "",
  isActive: true,
});

/* ─── Component ─── */

export default function SubscriptionPackagesPage() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPackage | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [features, setFeatures] = useState<PackageFeature[]>([]);
  const [prices, setPrices] = useState<PackagePrice[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Expanded row for inline features/prices
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Archive confirm dialog
  const [archiveTarget, setArchiveTarget] =
    useState<SubscriptionPackage | null>(null);

  /* ─── Data Loading ─── */

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const data = await api.get<SubscriptionPackage[]>(
        "/admin/subscriptions/packages",
      );
      setPackages(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  /* ─── Modal Handlers ─── */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFeatures([emptyFeature()]);
    setPrices([emptyPrice()]);
    setFormError("");
    setModal(true);
  };

  const openEdit = (pkg: SubscriptionPackage) => {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description,
      status: pkg.status,
      displayOrder: pkg.displayOrder,
    });
    setFeatures(pkg.features.length > 0 ? [...pkg.features] : [emptyFeature()]);
    setPrices(pkg.prices.length > 0 ? [...pkg.prices] : [emptyPrice()]);
    setFormError("");
    setModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("Package name is required.");
      return;
    }
    if (!form.slug.trim()) {
      setFormError("Slug is required.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const body = {
        ...form,
        features: features.filter((f) => f.key.trim() || f.label.trim()),
        prices: prices.filter((p) => p.price > 0 || p.stripePriceId.trim()),
      };

      if (editing) {
        await api.put(`/admin/subscriptions/packages/${editing.id}`, body);
      } else {
        await api.post("/admin/subscriptions/packages", body);
      }
      setModal(false);
      fetchPackages();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Feature Helpers ─── */

  const updateFeature = (idx: number, patch: Partial<PackageFeature>) => {
    setFeatures((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    );
  };

  const removeFeature = (idx: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ─── Price Helpers ─── */

  const updatePrice = (idx: number, patch: Partial<PackagePrice>) => {
    setPrices((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };

  const removePrice = (idx: number) => {
    setPrices((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ─── Archive ─── */

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await api.put(`/admin/subscriptions/packages/${archiveTarget.id}`, {
        status: "archived",
      });
      setArchiveTarget(null);
      fetchPackages();
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* ─── Price summary text ─── */

  const priceSummary = (pkg: SubscriptionPackage) => {
    const active = pkg.prices.filter((p) => p.isActive);
    if (active.length === 0) return "No prices";
    return active
      .map(
        (p) =>
          `${p.currency} ${p.price}/${BILLING_LABELS[p.billingCycle] || p.billingCycle}`,
      )
      .join(", ");
  };

  /* ─── Render ─── */

  if (loading && packages.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Subscription Packages
          </h1>
          <p className="text-gray-500 mt-1">
            Manage plans, features, and pricing
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Create Package
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Packages Table */}
      {packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-medium">
            No subscription packages yet
          </p>
          <p className="text-sm text-gray-300 mt-1">
            Create your first package to get started
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Package
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Prices
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Subscribers
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    {/* Main Row */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === pkg.id ? null : pkg.id)
                        }
                        className="flex items-center gap-2 text-left group"
                      >
                        {expandedId === pkg.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                            {pkg.name}
                          </p>
                          <p className="text-xs text-gray-400">{pkg.slug}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[pkg.status]}`}
                      >
                        {pkg.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {priceSummary(pkg)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                        {pkg.subscriberCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-500">
                        {pkg.displayOrder}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(pkg)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {pkg.status !== "archived" && (
                          <button
                            onClick={() => setArchiveTarget(pkg)}
                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded Detail Panel */}
          {expandedId &&
            (() => {
              const pkg = packages.find((p) => p.id === expandedId);
              if (!pkg) return null;
              return (
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Features */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <ListChecks className="w-4 h-4 text-primary-500" />
                        <h3 className="text-sm font-semibold text-gray-700">
                          Features ({pkg.features.length})
                        </h3>
                      </div>
                      {pkg.features.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          No features defined
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {pkg.features
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((f, i) => (
                              <li
                                key={f.id || i}
                                className="flex items-center gap-2 text-sm"
                              >
                                {f.included ? (
                                  <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="w-5 h-5 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center text-xs font-bold">
                                    ✗
                                  </span>
                                )}
                                <span className="text-gray-700">{f.label}</span>
                                <span className="text-gray-400 text-xs">
                                  ({f.key})
                                </span>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                    {/* Prices */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <h3 className="text-sm font-semibold text-gray-700">
                          Prices ({pkg.prices.length})
                        </h3>
                      </div>
                      {pkg.prices.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          No prices defined
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {pkg.prices.map((p, i) => (
                            <div
                              key={p.id || i}
                              className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
                            >
                              <div>
                                <span className="text-sm font-medium text-gray-900">
                                  {p.currency} {p.price}
                                </span>
                                <span className="text-xs text-gray-400 ml-2">
                                  /{" "}
                                  {BILLING_LABELS[p.billingCycle] ||
                                    p.billingCycle}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {p.stripePriceId && (
                                  <span className="text-xs text-gray-400 font-mono">
                                    {p.stripePriceId.slice(0, 20)}…
                                  </span>
                                )}
                                {p.isActive ? (
                                  <Eye className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-gray-300" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {pkg.description && (
                    <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-200">
                      {pkg.description}
                    </p>
                  )}
                </div>
              );
            })()}
        </div>
      )}

      {/* ─── Create / Edit Modal ─── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8"
          onClick={() => setModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? "Edit" : "Create"} Package
              </h2>
              <button
                onClick={() => setModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl mb-4 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {formError}
              </div>
            )}

            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Pro Plan"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug *
                  </label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="e.g. pro-plan"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as PackageStatus,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        displayOrder: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              {/* ── Features Section ── */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-primary-500" />
                    <h3 className="text-sm font-semibold text-gray-700">
                      Features
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFeatures([
                        ...features,
                        { ...emptyFeature(), sortOrder: features.length },
                      ])
                    }
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="space-y-2">
                  {features.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-gray-50 rounded-lg p-2"
                    >
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <input
                        value={f.key}
                        onChange={(e) =>
                          updateFeature(idx, { key: e.target.value })
                        }
                        placeholder="Key"
                        className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none font-mono"
                      />
                      <input
                        value={f.label}
                        onChange={(e) =>
                          updateFeature(idx, { label: e.target.value })
                        }
                        placeholder="Label"
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={f.included}
                          onChange={(e) =>
                            updateFeature(idx, { included: e.target.checked })
                          }
                          className="w-3.5 h-3.5 rounded text-primary-500 focus:ring-primary-500"
                        />
                        Included
                      </label>
                      <button
                        onClick={() => removeFeature(idx)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Prices Section ── */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <h3 className="text-sm font-semibold text-gray-700">
                      Prices
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrices([...prices, emptyPrice()])}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + Add Price
                  </button>
                </div>
                <div className="space-y-2">
                  {prices.map((p, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 bg-gray-50 rounded-lg p-2 items-center"
                    >
                      <div className="col-span-3">
                        <select
                          value={p.billingCycle}
                          onChange={(e) =>
                            updatePrice(idx, { billingCycle: e.target.value })
                          }
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                        >
                          {BILLING_CYCLES.map((c) => (
                            <option key={c} value={c}>
                              {BILLING_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          value={p.price}
                          onChange={(e) =>
                            updatePrice(idx, {
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          value={p.currency}
                          onChange={(e) =>
                            updatePrice(idx, {
                              currency: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="USD"
                          maxLength={3}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none font-mono uppercase"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          value={p.stripePriceId}
                          onChange={(e) =>
                            updatePrice(idx, { stripePriceId: e.target.value })
                          }
                          placeholder="price_..."
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none font-mono"
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <label
                          className="cursor-pointer"
                          title={p.isActive ? "Active" : "Inactive"}
                        >
                          <input
                            type="checkbox"
                            checked={p.isActive}
                            onChange={(e) =>
                              updatePrice(idx, { isActive: e.target.checked })
                            }
                            className="w-3.5 h-3.5 rounded text-primary-500 focus:ring-primary-500"
                          />
                        </label>
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <button
                          onClick={() => removePrice(idx)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.name.trim()}
                className="px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium"
              >
                {saving
                  ? "Saving…"
                  : editing
                    ? "Update Package"
                    : "Create Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Archive Confirmation Dialog ─── */}
      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setArchiveTarget(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Archive className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Archive Package</h3>
                <p className="text-sm text-gray-500">
                  This action can be reversed
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to archive{" "}
              <strong>{archiveTarget.name}</strong>?
              {archiveTarget.subscriberCount > 0 && (
                <span className="block mt-1 text-amber-600 font-medium">
                  This package has {archiveTarget.subscriberCount} active
                  subscriber{archiveTarget.subscriberCount !== 1 ? "s" : ""}.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all text-sm font-medium"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
