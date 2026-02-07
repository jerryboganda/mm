import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Edit2, Trash2, Loader2, Megaphone, ToggleLeft, ToggleRight } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'update' | 'promo';
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-50 text-blue-700',
  warning: 'bg-amber-50 text-amber-700',
  update: 'bg-emerald-50 text-emerald-700',
  promo: 'bg-purple-50 text-purple-700',
};

const TYPES = ['info', 'warning', 'update', 'promo'] as const;

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ title: '', message: '', type: 'info' as string, isActive: true, expiresAt: '' });
  const [saving, setSaving] = useState(false);

  const fetchList = () => {
    setLoading(true);
    api.get<Announcement[]>('/admin/announcements')
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchList(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', message: '', type: 'info', isActive: true, expiresAt: '' });
    setModal(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title,
      message: a.message,
      type: a.type,
      isActive: a.isActive,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : '',
    });
    setModal(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const body = { ...form, expiresAt: form.expiresAt || null };
      if (editing) {
        await api.put(`/admin/announcements/${editing.id}`, body);
      } else {
        await api.post('/admin/announcements', body);
      }
      setModal(false);
      fetchList();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await api.put(`/admin/announcements/${a.id}`, { isActive: !a.isActive });
      fetchList();
    } catch (e) { console.error(e); }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      fetchList();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 mt-1">Push banners to all app users</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all text-sm font-medium">
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Megaphone className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-medium">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className={`bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4 ${!a.isActive ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md uppercase ${TYPE_COLORS[a.type]}`}>{a.type}</span>
                  {!a.isActive && <span className="text-xs font-medium text-gray-400">Inactive</span>}
                  {a.expiresAt && (
                    <span className="text-xs text-gray-400">Expires {new Date(a.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{a.message}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleActive(a)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600" title={a.isActive ? 'Deactivate' : 'Activate'}>
                  {a.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => openEdit(a)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-500">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => remove(a.id)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Edit' : 'Create'} Announcement</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none">
                    {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
                  <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
              <button onClick={submit} disabled={saving || !form.title.trim()} className="px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium">
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
