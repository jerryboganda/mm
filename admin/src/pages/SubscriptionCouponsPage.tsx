import { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Ticket,
  X,
  AlertCircle,
  Search,
  Copy,
  BarChart3,
  Calendar,
  Percent,
  DollarSign,
  Hash,
  Filter,
  Download,
  Link as LinkIcon,
  Check,
} from "lucide-react";

/* ─── Types ─── */

interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  currency: string;
  maxUses: number | null;
  currentUses: number;
  validFrom: string;
  validUntil: string | null;
  campaign: string;
  isActive: boolean;
  minimumAmount: number;
  applicablePackages: string[];
  durationDaysOverride?: number | null;
  createdAt: string;
}

interface PackageOption {
  id: string;
  name: string;
  code: string;
}

interface CouponAnalytics {
  totalRedemptions: number;
  totalDiscountGiven: number;
  averageOrderValue: number;
  topCoupons: { code: string; redemptions: number; discountGiven: number }[];
}

type DiscountType = "percentage" | "fixed";

const STATUS_STYLES = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  expired: "bg-red-100 text-red-600",
  exhausted: "bg-amber-100 text-amber-700",
};

/* ─── Helpers ─── */

const couponStatus = (c: Coupon) => {
  if (!c.isActive) return "inactive";
  if (c.validUntil && new Date(c.validUntil) < new Date()) return "expired";
  if (c.maxUses !== null && c.currentUses >= c.maxUses) return "exhausted";
  return "active";
};

const emptyForm = () => ({
  code: "",
  discountType: "percentage" as DiscountType,
  discountValue: 0,
  currency: "PKR",
  maxUses: "" as string | number,
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: "",
  campaign: "",
  isActive: true,
  minimumAmount: 0,
  applicablePackages: [] as string[],
  durationDaysOverride: "" as string | number,
});

const emptyBulkForm = () => ({
  prefix: "",
  count: 10,
  discountType: "percentage" as DiscountType,
  discountValue: 10,
  currency: "PKR",
  maxUsesPerCoupon: "" as string | number,
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: "",
  campaign: "",
  applicablePackages: [] as string[],
  durationDaysOverride: "" as string | number,
});

/* ─── Component ─── */

export default function SubscriptionCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  // Modal
  const [modal, setModal] = useState<
    "create" | "edit" | "bulk" | "analytics" | null
  >(null);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [bulkForm, setBulkForm] = useState(emptyBulkForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Analytics
  const [analytics, setAnalytics] = useState<CouponAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  /* ─── Data Loading ─── */

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await api.get<Coupon[]>("/admin/subscriptions/coupons");
      setCoupons(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const data = await api.get<PackageOption[]>("/admin/subscriptions/packages");
      setPackages(data || []);
    } catch (err: any) {
      console.error("Error fetching packages", err);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await api.get<CouponAnalytics>(
        "/admin/subscriptions/coupons/analytics",
      );
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
    fetchPackages();
  }, []);

  /* ─── Derived Data ─── */

  const campaigns = useMemo(() => {
    const set = new Set(coupons.map((c) => c.campaign).filter(Boolean));
    return Array.from(set).sort();
  }, [coupons]);

  const filtered = useMemo(() => {
    return coupons.filter((c) => {
      if (
        searchQuery &&
        !c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      if (filterCampaign && c.campaign !== filterCampaign) return false;
      if (filterStatus && couponStatus(c) !== filterStatus) return false;
      if (filterType && c.discountType !== filterType) return false;
      return true;
    });
  }, [coupons, searchQuery, filterCampaign, filterStatus, filterType]);

  /* ─── Modal Handlers ─── */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModal("create");
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      currency: c.currency,
      maxUses: c.maxUses ?? "",
      validFrom: c.validFrom ? c.validFrom.slice(0, 10) : "",
      validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
      campaign: c.campaign || "",
      isActive: c.isActive,
      minimumAmount: c.minimumAmount || 0,
      applicablePackages: c.applicablePackages || [],
      durationDaysOverride: c.durationDaysOverride ?? "",
    });
    setFormError("");
    setModal("edit");
  };

  const openBulk = () => {
    setBulkForm(emptyBulkForm());
    setFormError("");
    setModal("bulk");
  };

  const openAnalytics = () => {
    setModal("analytics");
    if (!analytics) fetchAnalytics();
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      setFormError("Coupon code is required.");
      return;
    }
    if (form.discountValue <= 0) {
      setFormError("Discount value must be positive.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: String(form.discountValue),
        minPurchaseAmount: form.minimumAmount ? String(form.minimumAmount) : null,
        durationDaysOverride:
          form.durationDaysOverride !== "" && form.durationDaysOverride !== null
            ? Number(form.durationDaysOverride)
            : null,
        applicablePackageIds:
          form.applicablePackages.length > 0 ? form.applicablePackages : null,
        maxTotalUses: form.maxUses === "" ? null : Number(form.maxUses),
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        campaignId: form.campaign.trim() || null,
        isActive: form.isActive,
      };

      if (editing) {
        await api.put(`/admin/subscriptions/coupons/${editing.id}`, body);
      } else {
        await api.post("/admin/subscriptions/coupons", body);
      }
      setModal(null);
      fetchCoupons();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkForm.prefix.trim()) {
      setFormError("Prefix is required.");
      return;
    }
    if (bulkForm.count < 1 || bulkForm.count > 1000) {
      setFormError("Count must be 1–1000.");
      return;
    }
    if (bulkForm.discountValue <= 0) {
      setFormError("Discount value must be positive.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const body = {
        prefix: bulkForm.prefix.trim().toUpperCase(),
        count: Number(bulkForm.count),
        discountType: bulkForm.discountType,
        discountValue: String(bulkForm.discountValue),
        maxUsesPerUser:
          bulkForm.maxUsesPerCoupon === ""
            ? 1
            : Number(bulkForm.maxUsesPerCoupon),
        durationDaysOverride:
          bulkForm.durationDaysOverride !== "" &&
          bulkForm.durationDaysOverride !== null
            ? Number(bulkForm.durationDaysOverride)
            : null,
        applicablePackageIds:
          bulkForm.applicablePackages.length > 0
            ? bulkForm.applicablePackages
            : null,
        validFrom: bulkForm.validFrom || null,
        validUntil: bulkForm.validUntil || null,
        campaignId: bulkForm.campaign.trim() || null,
      };
      await api.post("/admin/subscriptions/coupons/bulk", body);
      setModal(null);
      fetchCoupons();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Delete coupon "${c.code}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/subscriptions/coupons/${c.id}`);
      fetchCoupons();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleActive = async (c: Coupon) => {
    try {
      await api.put(`/admin/subscriptions/coupons/${c.id}`, {
        isActive: !c.isActive,
      });
      fetchCoupons();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const copyShareLink = (code: string, id: string) => {
    const link = `https://maternalmind.com.pk/subscription?coupon=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  /* ─── Render ─── */

  if (loading && coupons.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-500 mt-1">
            {coupons.length} coupon{coupons.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openAnalytics}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium"
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
          <button
            onClick={openBulk}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium"
          >
            <Copy className="w-4 h-4" /> Bulk Generate
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create Coupon
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code…"
            className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          />
        </div>
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
          <option value="exhausted">Exhausted</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Types</option>
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed Amount</option>
        </select>
      </div>

      {/* Coupons Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Ticket className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-medium">
            {coupons.length === 0
              ? "No coupons yet"
              : "No coupons match your filters"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Discount / Duration
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Uses
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Valid Period
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => {
                  const status = couponStatus(c);
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-primary-400 flex-shrink-0" />
                          <span className="text-sm font-mono font-medium text-gray-900">
                            {c.code}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {c.discountType === "percentage" ? (
                              <Percent className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {c.discountType === "percentage"
                                ? `${c.discountValue}%`
                                : `${c.currency} ${c.discountValue}`}
                            </span>
                            <span className="text-xs text-gray-400">off</span>
                          </div>
                          {c.durationDaysOverride ? (
                            <span className="text-xs text-purple-600 font-medium">
                              Duration: {c.durationDaysOverride} days
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-gray-900">
                          {c.currentUses}
                        </span>
                        <span className="text-xs text-gray-400">
                          /{c.maxUses ?? "∞"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>
                            {c.validFrom
                              ? new Date(c.validFrom).toLocaleDateString()
                              : "—"}
                            {" → "}
                            {c.validUntil
                              ? new Date(c.validUntil).toLocaleDateString()
                              : "No end"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.campaign ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                            {c.campaign}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => copyCode(c.code, c.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:text-primary-600 bg-gray-50 hover:bg-primary-50 border border-gray-200 rounded-lg transition-colors"
                            title="Copy Code"
                          >
                            {copiedCodeId === c.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-green-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => copyShareLink(c.code, c.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:text-primary-600 bg-gray-50 hover:bg-primary-50 border border-gray-200 rounded-lg transition-colors"
                            title="Copy Share Link"
                          >
                            {copiedLinkId === c.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-green-600">Link Copied</span>
                              </>
                            ) : (
                              <>
                                <LinkIcon className="w-3.5 h-3.5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => toggleActive(c)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium ${c.isActive ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`}
                            title={c.isActive ? "Deactivate" : "Activate"}
                          >
                            {c.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Create / Edit Modal ─── */}
      {(modal === "create" || modal === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? "Edit" : "Create"} Coupon
              </h2>
              <button
                onClick={() => setModal(null)}
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coupon Code *
                </label>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. SUMMER25"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={form.discountType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        discountType: e.target.value as DiscountType,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value{" "}
                    {form.discountType === "percentage"
                      ? "(%)"
                      : `(${form.currency})`}{" "}
                    *
                  </label>
                  <input
                    type="number"
                    step={form.discountType === "percentage" ? "1" : "0.01"}
                    value={form.discountValue}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        discountValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              {form.discountType === "fixed" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <input
                      value={form.currency}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          currency: e.target.value.toUpperCase(),
                        })
                      }
                      maxLength={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Order
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.minimumAmount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          minimumAmount: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Duration Override (Days) — e.g. 14, 30, 90, 365. Leave empty to default to package duration
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.durationDaysOverride}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationDaysOverride:
                        e.target.value === "" ? "" : parseInt(e.target.value),
                    })
                  }
                  placeholder="e.g. 14, 30, 90, 365 (Leave empty for package default)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Packages (Applicable Packages)
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                  {packages.length === 0 ? (
                    <p className="text-xs text-gray-400">All packages (or loading packages…)</p>
                  ) : (
                    packages.map((pkg) => {
                      const isSelected = form.applicablePackages.includes(pkg.id);
                      return (
                        <label
                          key={pkg.id}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100/70 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.applicablePackages, pkg.id]
                                : form.applicablePackages.filter((id) => id !== pkg.id);
                              setForm({ ...form, applicablePackages: next });
                            }}
                            className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500"
                          />
                          <span className="font-medium">{pkg.name}</span>
                          <span className="text-xs text-gray-400 font-mono">({pkg.code})</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Leave empty to make valid for all packages.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Uses
                  </label>
                  <input
                    type="number"
                    value={form.maxUses}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        maxUses:
                          e.target.value === "" ? "" : parseInt(e.target.value),
                      })
                    }
                    placeholder="Unlimited"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign
                  </label>
                  <input
                    value={form.campaign}
                    onChange={(e) =>
                      setForm({ ...form, campaign: e.target.value })
                    }
                    placeholder="e.g. summer-2024"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) =>
                      setForm({ ...form, validFrom: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) =>
                      setForm({ ...form, validUntil: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.code.trim()}
                className="px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium"
              >
                {saving
                  ? "Saving…"
                  : editing
                    ? "Update Coupon"
                    : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Generate Modal ─── */}
      {modal === "bulk" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                Bulk Generate Coupons
              </h2>
              <button
                onClick={() => setModal(null)}
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

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code Prefix *
                  </label>
                  <input
                    value={bulkForm.prefix}
                    onChange={(e) =>
                      setBulkForm({
                        ...bulkForm,
                        prefix: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. PROMO"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none font-mono uppercase"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Codes: {bulkForm.prefix || "PROMO"}-XXXX
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Count *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={bulkForm.count}
                    onChange={(e) =>
                      setBulkForm({
                        ...bulkForm,
                        count: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={bulkForm.discountType}
                    onChange={(e) =>
                      setBulkForm({
                        ...bulkForm,
                        discountType: e.target.value as DiscountType,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value *
                  </label>
                  <input
                    type="number"
                    value={bulkForm.discountValue}
                    onChange={(e) =>
                      setBulkForm({
                        ...bulkForm,
                        discountValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Duration Override (Days) — e.g. 14, 30, 90, 365. Leave empty to default to package duration
                </label>
                <input
                  type="number"
                  min={1}
                  value={bulkForm.durationDaysOverride}
                  onChange={(e) =>
                    setBulkForm({
                      ...bulkForm,
                      durationDaysOverride:
                        e.target.value === "" ? "" : parseInt(e.target.value),
                    })
                  }
                  placeholder="e.g. 14, 30, 90, 365 (Leave empty for package default)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Packages (Applicable Packages)
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                  {packages.length === 0 ? (
                    <p className="text-xs text-gray-400">All packages (or loading packages…)</p>
                  ) : (
                    packages.map((pkg) => {
                      const isSelected = bulkForm.applicablePackages.includes(pkg.id);
                      return (
                        <label
                          key={pkg.id}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100/70 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...bulkForm.applicablePackages, pkg.id]
                                : bulkForm.applicablePackages.filter((id) => id !== pkg.id);
                              setBulkForm({ ...bulkForm, applicablePackages: next });
                            }}
                            className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500"
                          />
                          <span className="font-medium">{pkg.name}</span>
                          <span className="text-xs text-gray-400 font-mono">({pkg.code})</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Leave empty to apply to all packages.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Uses per Coupon
                  </label>
                  <input
                    type="number"
                    value={bulkForm.maxUsesPerCoupon}
                    onChange={(e) =>
                      setBulkForm({
                        ...bulkForm,
                        maxUsesPerCoupon:
                          e.target.value === "" ? "" : parseInt(e.target.value),
                      })
                    }
                    placeholder="Unlimited"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign
                  </label>
                  <input
                    value={bulkForm.campaign}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, campaign: e.target.value })
                    }
                    placeholder="e.g. launch-2024"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={bulkForm.validFrom}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, validFrom: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={bulkForm.validUntil}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, validUntil: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkGenerate}
                disabled={saving || !bulkForm.prefix.trim()}
                className="px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium"
              >
                {saving ? "Generating…" : `Generate ${bulkForm.count} Coupons`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Analytics Modal ─── */}
      {modal === "analytics" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                Coupon Analytics
              </h2>
              <button
                onClick={() => setModal(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {analyticsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : !analytics ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Failed to load analytics data.
              </p>
            ) : (
              <div className="space-y-5">
                {/* KPI Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">
                      {analytics.totalRedemptions}
                    </p>
                    <p className="text-xs text-blue-500 font-medium mt-1">
                      Redemptions
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">
                      ${analytics.totalDiscountGiven.toFixed(2)}
                    </p>
                    <p className="text-xs text-green-500 font-medium mt-1">
                      Total Discount
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-purple-700">
                      ${analytics.averageOrderValue.toFixed(2)}
                    </p>
                    <p className="text-xs text-purple-500 font-medium mt-1">
                      Avg Order
                    </p>
                  </div>
                </div>

                {/* Top Coupons */}
                {analytics.topCoupons.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Top Performing Coupons
                    </h3>
                    <div className="space-y-2">
                      {analytics.topCoupons.map((tc) => (
                        <div
                          key={tc.code}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-primary-400" />
                            <span className="text-sm font-mono font-medium text-gray-900">
                              {tc.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>{tc.redemptions} uses</span>
                            <span className="font-medium text-gray-700">
                              ${tc.discountGiven.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
