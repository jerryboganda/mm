import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Search,
  Pencil,
  Trash2,
  Loader2,
  Users as UsersIcon,
  Shield,
  AlertCircle,
  X,
  Crown,
  User,
  Monitor,
  LogOut,
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  isEmailVerified: boolean;
  createdAt: string;
  activeDeviceCount: number;
  deviceLimitOverrideEnabled: boolean;
  deviceLimitMax: number | null;
}

interface UserSession {
  id: string;
  deviceId: string;
  deviceLabel: string | null;
  platform: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    role: "",
    name: "",
    subscriptionStatus: "",
    subscriptionPlan: "",
    isEmailVerified: false,
  });
  const [deviceLimitForm, setDeviceLimitForm] = useState({
    deviceLimitOverrideEnabled: false,
    deviceLimitMax: 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sessionUser, setSessionUser] = useState<UserItem | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const load = async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (search) params.set("search", search);
      if (filterRole) params.set("role", filterRole);
      const result = await api.get<{ data: UserItem[]; total: number }>(
        `/admin/users?${params}`,
      );
      setUsers(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, filterRole]);

  const openEdit = (u: UserItem) => {
    setEditUser(u);
    setEditForm({
      role: u.role,
      name: u.name,
      subscriptionStatus: u.subscriptionStatus,
      subscriptionPlan: u.subscriptionPlan || "",
      isEmailVerified: u.isEmailVerified,
    });
    setDeviceLimitForm({
      deviceLimitOverrideEnabled: u.deviceLimitOverrideEnabled,
      deviceLimitMax: u.deviceLimitMax || 3,
    });
    setShowEdit(true);
    setError("");
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/admin/users/${editUser.id}`, {
        ...editForm,
        deviceLimitOverrideEnabled: deviceLimitForm.deviceLimitOverrideEnabled,
        deviceLimitMax: deviceLimitForm.deviceLimitOverrideEnabled
          ? Math.min(
              20,
              Math.max(1, Number(deviceLimitForm.deviceLimitMax) || 3),
            )
          : null,
      });
      setShowEdit(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openSessions = async (u: UserItem) => {
    setSessionUser(u);
    setLoadingSessions(true);
    setError("");
    try {
      const result = await api.get<{ sessions: UserSession[] }>(
        `/admin/device-limits/users/${u.id}/sessions`,
      );
      setSessions(result.sessions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (!confirm("Sign out this device?")) return;
    await api.delete(`/admin/device-limits/sessions/${sessionId}`);
    if (sessionUser) await openSessions(sessionUser);
    load();
  };

  const revokeAllSessions = async () => {
    if (!sessionUser) return;
    if (!confirm(`Sign out all devices for ${sessionUser.email}?`)) return;
    await api.delete(`/admin/device-limits/users/${sessionUser.id}/sessions`);
    await openSessions(sessionUser);
    load();
  };

  const handleDelete = async (u: UserItem) => {
    if (
      !confirm(
        `Delete user "${u.name}" (${u.email})? This action cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalPages = Math.ceil(total / 20);

  if (loading && users.length === 0)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 mt-1">{total} users total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => {
            setFilterRole(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Edit Modal */}
      {showEdit && editUser && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit User</h2>
              <button onClick={() => setShowEdit(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl mb-4 text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Verified
                </label>
                <select
                  value={editForm.isEmailVerified ? "true" : "false"}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      isEmailVerified: e.target.value === "true",
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                >
                  <option value="true">✅ Verified</option>
                  <option value="false">❌ Unverified</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscription Status
                </label>
                <select
                  value={editForm.subscriptionStatus}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      subscriptionStatus: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                >
                  <option value="none">None</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscription Plan
                </label>
                <select
                  value={editForm.subscriptionPlan}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      subscriptionPlan: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                >
                  <option value="">None</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={deviceLimitForm.deviceLimitOverrideEnabled}
                    onChange={(e) =>
                      setDeviceLimitForm({
                        ...deviceLimitForm,
                        deviceLimitOverrideEnabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  Custom device limit for this user
                </label>
                {deviceLimitForm.deviceLimitOverrideEnabled && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Devices
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={deviceLimitForm.deviceLimitMax}
                      onChange={(e) =>
                        setDeviceLimitForm({
                          ...deviceLimitForm,
                          deviceLimitMax: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {saving ? "Saving…" : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sessionUser && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSessionUser(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold">Active Devices</h2>
                <p className="text-sm text-gray-500">
                  {sessionUser.name} • {sessionUser.email}
                </p>
              </div>
              <button onClick={() => setSessionUser(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {sessions.length} active device
                {sessions.length === 1 ? "" : "s"}
              </p>
              <button
                onClick={revokeAllSessions}
                disabled={sessions.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" /> Sign out all
              </button>
            </div>

            {loadingSessions ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-center text-gray-400 py-10">
                No active devices.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {sessions.map((session) => (
                  <div key={session.id} className="p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <Monitor className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {session.deviceLabel || session.platform || "Device"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {session.userAgent || session.deviceId}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span>IP: {session.ipAddress || "Unknown"}</span>
                        <span>
                          Last seen:{" "}
                          {new Date(session.lastSeenAt).toLocaleString()}
                        </span>
                        <span>
                          Expires:{" "}
                          {new Date(session.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => revokeSession(session.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Devices
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${u.role === "admin" ? "bg-primary-100" : "bg-gray-100"}`}
                      >
                        {u.role === "admin" ? (
                          <Crown className="w-4 h-4 text-primary-600" />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {u.name}
                        </p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-600"}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${u.isEmailVerified ? "bg-green-500" : "bg-gray-300"}`}
                      />
                      <span className="text-xs text-gray-500">
                        {u.isEmailVerified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.subscriptionStatus === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {u.subscriptionPlan
                        ? `${u.subscriptionPlan} (${u.subscriptionStatus})`
                        : u.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openSessions(u)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-primary-50 hover:text-primary-700"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      {u.activeDeviceCount || 0}
                      {u.deviceLimitOverrideEnabled
                        ? ` / ${u.deviceLimitMax || 1}`
                        : ""}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openSessions(u)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(u)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
