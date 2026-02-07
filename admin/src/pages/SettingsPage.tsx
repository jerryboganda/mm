import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Loader2, Mail, Save, FileText, Clock } from 'lucide-react';

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
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
  const [tab, setTab] = useState<'email' | 'audit'>('email');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Platform configuration & activity logs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('email')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
        </button>
        <button onClick={() => setTab('audit')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Audit Log</span>
        </button>
      </div>

      {tab === 'email' ? <EmailSettingsTab /> : <AuditLogTab />}
    </div>
  );
}

function EmailSettingsTab() {
  const [form, setForm] = useState<EmailSettings>({
    smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', fromEmail: '', fromName: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<EmailSettings>('/admin/email-settings')
      .then((s) => setForm(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/email-settings', form);
      setMsg('Settings saved ✓');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { console.error(e); setMsg('Failed to save'); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  const field = (label: string, key: keyof EmailSettings, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="w-5 h-5 text-primary-500" />
        <h2 className="text-lg font-semibold text-gray-900">SMTP / Email Settings</h2>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {field('SMTP Host', 'smtpHost')}
          {field('SMTP Port', 'smtpPort', 'number')}
        </div>
        {field('SMTP User / Email', 'smtpUser')}
        {field('SMTP Password', 'smtpPass', 'password')}
        <div className="grid grid-cols-2 gap-4">
          {field('From Email', 'fromEmail')}
          {field('From Name', 'fromName')}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-6">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all text-sm font-medium">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {msg && <span className="text-sm text-emerald-600 font-medium">{msg}</span>}
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
    api.get<{ logs: AuditLog[]; total: number }>(`/admin/analytics/audit-logs?page=${page}&limit=${perPage}`)
      .then((r) => { setLogs(r.logs); setTotal(r.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / perPage);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

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
                    <span className="font-medium">{l.adminName || 'Admin'}</span>{' '}
                    <span className="text-gray-500">{l.action}</span>{' '}
                    <span className="text-gray-600">{l.entityType}{l.entityId ? ` #${l.entityId}` : ''}</span>
                  </p>
                  {l.details && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{JSON.stringify(l.details)}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors">Prev</button>
              <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
