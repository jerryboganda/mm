import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  Loader2,
  Users,
  DollarSign,
  TrendingDown,
  UserPlus,
  ArrowRight,
  Package,
  Ticket,
  CreditCard,
  Activity,
  Calendar,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

/* ─── Types ─── */

interface SubscriptionKpis {
  activeSubscribers: number;
  mrr: number;
  mrrCurrency: string;
  churnRate: number;
  newThisMonth: number;
  trialUsers: number;
  cancelledThisMonth: number;
}

interface RevenueByPackage {
  packageId: string;
  packageName: string;
  subscriberCount: number;
  revenue: number;
  currency: string;
  percentOfTotal: number;
}

interface SubscriberGrowthPoint {
  date: string;
  total: number;
  new: number;
  churned: number;
}

interface AuditEvent {
  id: string;
  type: string;
  description: string;
  userId: string;
  userName: string;
  packageName: string | null;
  createdAt: string;
}

/* ─── KPI Card ─── */

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div
          className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Link ─── */

function QuickLink({
  to,
  icon: Icon,
  label,
  description,
  color,
}: {
  to: string;
  icon: any;
  label: string;
  description: string;
  color: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
    >
      <div
        className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
    </Link>
  );
}

/* ─── Event Type Styles ─── */

const EVENT_STYLES: Record<string, string> = {
  subscription_created: "bg-green-100 text-green-700",
  subscription_renewed: "bg-blue-100 text-blue-700",
  subscription_cancelled: "bg-red-100 text-red-600",
  subscription_expired: "bg-gray-100 text-gray-600",
  subscription_upgraded: "bg-purple-100 text-purple-700",
  subscription_downgraded: "bg-amber-100 text-amber-700",
  payment_succeeded: "bg-emerald-100 text-emerald-700",
  payment_failed: "bg-red-100 text-red-600",
  coupon_applied: "bg-indigo-100 text-indigo-700",
};

const eventStyle = (type: string) =>
  EVENT_STYLES[type] || "bg-gray-100 text-gray-600";

/* ─── Component ─── */

export default function SubscriptionDashboardPage() {
  const [kpis, setKpis] = useState<SubscriptionKpis | null>(null);
  const [revenueByPackage, setRevenueByPackage] = useState<RevenueByPackage[]>(
    [],
  );
  const [growth, setGrowth] = useState<SubscriberGrowthPoint[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [kpiData, revData, growthData, eventsData] = await Promise.all([
        api.get<SubscriptionKpis>("/admin/subscriptions/analytics/kpis"),
        api.get<RevenueByPackage[]>(
          "/admin/subscriptions/analytics/revenue-by-package",
        ),
        api.get<SubscriberGrowthPoint[]>(
          "/admin/subscriptions/analytics/subscriber-growth?days=30",
        ),
        api.get<AuditEvent[]>("/admin/subscriptions/analytics/events?limit=20"),
      ]);
      setKpis(kpiData);
      setRevenueByPackage(revData);
      setGrowth(growthData);
      setEvents(eventsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error && !kpis) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Subscription Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Subscription analytics and management
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-300 mb-3" />
          <p className="text-gray-500 font-medium mb-2">
            Failed to load dashboard
          </p>
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const totalRevenue = revenueByPackage.reduce((sum, r) => sum + r.revenue, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Subscription Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Subscription analytics and management
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-sm text-gray-600 font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{" "}
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Users}
            label="Active Subscribers"
            value={kpis.activeSubscribers.toLocaleString()}
            subtitle={
              kpis.trialUsers > 0 ? `${kpis.trialUsers} in trial` : undefined
            }
            color="bg-blue-500"
          />
          <KpiCard
            icon={DollarSign}
            label="MRR"
            value={`${kpis.mrrCurrency} ${kpis.mrr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Monthly Recurring Revenue"
            color="bg-green-500"
          />
          <KpiCard
            icon={TrendingDown}
            label="Churn Rate"
            value={`${kpis.churnRate.toFixed(1)}%`}
            subtitle={`${kpis.cancelledThisMonth} cancelled this month`}
            color={kpis.churnRate > 5 ? "bg-red-500" : "bg-amber-500"}
          />
          <KpiCard
            icon={UserPlus}
            label="New This Month"
            value={kpis.newThisMonth.toLocaleString()}
            subtitle="New subscribers"
            color="bg-purple-500"
          />
        </div>
      )}

      {/* Revenue by Package + Subscriber Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Package */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Revenue by Package
            </h2>
          </div>
          {revenueByPackage.length === 0 ? (
            <p className="text-gray-400 text-center py-12">
              No revenue data available.
            </p>
          ) : (
            <div className="space-y-3">
              {revenueByPackage.map((r) => (
                <div key={r.packageId} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {r.packageName}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        {r.currency}{" "}
                        {r.revenue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.max(r.percentOfTotal, 2)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">
                        {r.subscriberCount} subscriber
                        {r.subscriberCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-gray-400">
                        {r.percentOfTotal.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  Total
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {revenueByPackage[0]?.currency || "USD"}{" "}
                  {totalRevenue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Subscriber Growth (Table) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Subscriber Growth
            </h2>
            <span className="text-xs text-gray-400 ml-auto">Last 30 days</span>
          </div>
          {growth.length === 0 ? (
            <p className="text-gray-400 text-center py-12">
              No growth data available.
            </p>
          ) : (
            <div className="overflow-y-auto max-h-80">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                      New
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                      Churned
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {growth.map((g) => (
                    <tr key={g.date} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-sm text-gray-600">
                        {new Date(g.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-2 px-2 text-sm text-right font-medium text-gray-900">
                        {g.total}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {g.new > 0 ? (
                          <span className="text-sm text-green-600 font-medium">
                            +{g.new}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {g.churned > 0 ? (
                          <span className="text-sm text-red-500 font-medium">
                            -{g.churned}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Subscription Events */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
        </div>
        {events.length === 0 ? (
          <p className="text-gray-400 text-center py-12">
            No subscription events yet.
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0"
              >
                <div
                  className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase whitespace-nowrap ${eventStyle(evt.type)}`}
                >
                  {evt.type.replace(/_/g, " ")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{evt.description}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {evt.userName}
                    </span>
                    {evt.packageName && (
                      <span className="text-xs text-gray-400">
                        • {evt.packageName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {new Date(evt.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Manage</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <QuickLink
            to="/subscription-packages"
            icon={Package}
            label="Packages"
            description="Create and manage subscription plans"
            color="bg-primary-500"
          />
          <QuickLink
            to="/subscription-coupons"
            icon={Ticket}
            label="Coupons"
            description="Discount codes and promotions"
            color="bg-amber-500"
          />
          <QuickLink
            to="/users"
            icon={Users}
            label="Subscribers"
            description="View and manage user subscriptions"
            color="bg-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
