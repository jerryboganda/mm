import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Loader2, Flag, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface Report {
  id: number;
  userId: number;
  userName: string;
  topicId: number;
  topicTitle: string;
  contentBlockId: number | null;
  mcqId: number | null;
  type: string;
  description: string;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  reviewed: 'bg-blue-50 text-blue-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  dismissed: 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  reviewed: <AlertTriangle className="w-4 h-4" />,
  resolved: <CheckCircle className="w-4 h-4" />,
  dismissed: <XCircle className="w-4 h-4" />,
};

const STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'] as const;

export default function ContentReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchReports = () => {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    api.get<Report[]>(`/content-reports${qs}`)
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [statusFilter]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/content-reports/${id}`, { status });
      fetchReports();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Reports</h1>
          <p className="text-gray-500 mt-1">User-submitted error reports for content & MCQs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === '' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${statusFilter === s ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Flag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-medium">No reports found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${STATUS_COLORS[r.status]}`}>
                      {STATUS_ICONS[r.status]} {r.status}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">{r.type}</span>
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-900 font-medium">{r.description}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                    <span>By: <span className="text-gray-600">{r.userName || `User #${r.userId}`}</span></span>
                    <span>Topic: <span className="text-gray-600">{r.topicTitle || `#${r.topicId}`}</span></span>
                    {r.mcqId && <span>MCQ #{r.mcqId}</span>}
                    {r.contentBlockId && <span>Block #{r.contentBlockId}</span>}
                  </div>
                </div>

                {/* Status change dropdown */}
                <select
                  value={r.status}
                  onChange={(e) => updateStatus(r.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
