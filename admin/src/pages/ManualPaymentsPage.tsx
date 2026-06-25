import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import {
  Loader2,
  Check,
  X,
  ReceiptText,
  Plus,
  AlertCircle,
} from "lucide-react";

interface Proof {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  packageId: string;
  packageName: string | null;
  priceId: string | null;
  status: "pending" | "approved" | "rejected";
  amountClaimed: string | null;
  currency: string | null;
  paymentMethod: string | null;
  senderReference: string | null;
  userNote: string | null;
  proofImageUrl: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface PackagePrice {
  id: string;
  billingCycle: string;
  price: string;
  currency: string;
}
interface SubPackage {
  id: string;
  name: string;
  prices: PackagePrice[];
}

const STATUS_TABS = ["pending", "approved", "rejected", "all"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function ManualPaymentsPage() {
  const [status, setStatus] = useState<StatusTab>("pending");
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Proof | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const limit = 20;

  const fetchProofs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.get<{ proofs: Proof[]; total: number }>(
        `/admin/manual-payments?status=${status}&page=${page}&limit=${limit}`,
      );
      setProofs(r.proofs);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    fetchProofs();
  }, [fetchProofs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manual Payments</h1>
          <p className="text-gray-500 mt-1">
            Review uploaded payment proofs and activate subscriptions
          </p>
        </div>
        <button
          onClick={() => setGrantOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Grant Subscription
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              status === s
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : proofs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ReceiptText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            No {status === "all" ? "" : status} payment proofs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Proof</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {proofs.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <img
                        src={p.proofImageUrl}
                        alt="proof"
                        className="w-12 h-12 rounded-lg object-cover border border-gray-200 cursor-pointer"
                        onClick={() => setSelected(p)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {p.userName || "—"}
                      </div>
                      <div className="text-xs text-gray-500">{p.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {p.packageName || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {p.amountClaimed
                        ? `${p.currency || ""} ${p.amountClaimed}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBadge[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(p)}
                        className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200"
          >
            Next
          </button>
        </div>
      )}

      {selected && (
        <ReviewModal
          proof={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            fetchProofs();
          }}
        />
      )}

      {grantOpen && (
        <GrantModal
          onClose={() => setGrantOpen(false)}
          onDone={() => {
            setGrantOpen(false);
            fetchProofs();
          }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  proof,
  onClose,
  onDone,
}: {
  proof: Proof;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin/manual-payments/${proof.id}/approve`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin/manual-payments/${proof.id}/reject`, {
        rejectionReason: reason.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ label, value }: { label: string; value: string | null }) =>
    value ? (
      <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-gray-50 last:border-0">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900 font-medium text-right">{value}</span>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            Payment Proof Review
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6">
          <a href={proof.proofImageUrl} target="_blank" rel="noreferrer">
            <img
              src={proof.proofImageUrl}
              alt="payment proof"
              className="w-full rounded-xl border border-gray-200"
            />
          </a>

          <div>
            <Row label="User" value={proof.userName} />
            <Row label="Email" value={proof.userEmail} />
            <Row label="Package" value={proof.packageName} />
            <Row
              label="Amount"
              value={
                proof.amountClaimed
                  ? `${proof.currency || ""} ${proof.amountClaimed}`
                  : null
              }
            />
            <Row label="Method" value={proof.paymentMethod} />
            <Row label="Reference" value={proof.senderReference} />
            <Row label="Note" value={proof.userNote} />
            <Row
              label="Submitted"
              value={new Date(proof.createdAt).toLocaleString()}
            />
            <Row label="Status" value={proof.status} />
            <Row label="Rejection Reason" value={proof.rejectionReason} />

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mt-4">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            {proof.status === "pending" && (
              <div className="mt-5 space-y-3">
                {rejecting ? (
                  <>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for rejection (optional, emailed to user)"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={reject}
                        disabled={busy}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 text-sm font-medium"
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => setRejecting(false)}
                        disabled={busy}
                        className="px-4 py-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={approve}
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium"
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 disabled:opacity-50 text-sm font-medium"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GrantModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [packages, setPackages] = useState<SubPackage[]>([]);
  const [email, setEmail] = useState("");
  const [packageId, setPackageId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .get<{ packages: SubPackage[] }>("/subscriptions/packages")
      .then((r) => setPackages(r.packages))
      .catch(() => setError("Failed to load packages"));
  }, []);

  const selectedPkg = packages.find((p) => p.id === packageId);

  const submit = async () => {
    if (!email.trim() || !packageId || !priceId) {
      setError("Email, package and billing cycle are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/manual-payments/grant", {
        email: email.trim(),
        packageId,
        priceId,
      });
      setSuccess("Subscription granted ✓");
      setTimeout(onDone, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to grant subscription");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Grant Subscription
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Directly activate or extend a subscription for a user without a
            payment proof.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User Email
            </label>
            <input
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Package
            </label>
            <select
              className={inputCls}
              value={packageId}
              onChange={(e) => {
                setPackageId(e.target.value);
                setPriceId("");
              }}
            >
              <option value="">Select package…</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {selectedPkg && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Cycle
              </label>
              <select
                className={inputCls}
                value={priceId}
                onChange={(e) => setPriceId(e.target.value)}
              >
                <option value="">Select cycle…</option>
                {selectedPkg.prices.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.billingCycle} — {pr.currency} {pr.price}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-sm">
              {success}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 text-sm font-medium"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Grant Subscription
          </button>
        </div>
      </div>
    </div>
  );
}
