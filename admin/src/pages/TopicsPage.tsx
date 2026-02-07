import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Plus, Pencil, Trash2, Eye, EyeOff,
  Loader2, ArrowLeft, AlertCircle, FileText, Edit3,
} from 'lucide-react';

interface Topic {
  id: string;
  chapterId: string;
  title: string;
  description: string | null;
  order: number;
  isPublished: boolean;
  author: string | null;
}

interface Chapter {
  id: string;
  title: string;
  bookId: string;
}

export default function TopicsPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const [topicsList, setTopics] = useState<Topic[]>([]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [form, setForm] = useState({ title: '', description: '', author: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const ts = await api.get<Topic[]>(`/admin/content/chapters/${chapterId}/topics`);
      setTopics(ts);
      // Try to get chapter info
      try {
        // We'll get all books and find the chapter
        const books = await api.get<any[]>('/admin/content/books');
        for (const book of books) {
          const chs = await api.get<Chapter[]>(`/admin/content/books/${book.id}/chapters`);
          const ch = chs.find((c: any) => c.id === chapterId);
          if (ch) { setChapter({ ...ch, bookId: book.id }); break; }
        }
      } catch {}
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [chapterId]);

  const openCreate = () => { setEditTopic(null); setForm({ title: '', description: '', author: '' }); setShowForm(true); setError(''); };
  const openEdit = (t: Topic) => { setEditTopic(t); setForm({ title: t.title, description: t.description || '', author: t.author || '' }); setShowForm(true); setError(''); };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      if (editTopic) {
        await api.put(`/admin/content/topics/${editTopic.id}`, form);
      } else {
        await api.post('/admin/content/topics', { ...form, chapterId });
      }
      setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (t: Topic) => {
    if (!confirm(`Delete "${t.title}"? All content blocks and MCQs within it will be deleted.`)) return;
    try { await api.delete(`/admin/content/topics/${t.id}`); load(); } catch (err: any) { alert(err.message); }
  };

  const togglePublish = async (t: Topic) => {
    try { await api.put(`/admin/content/topics/${t.id}`, { isPublished: !t.isPublished }); load(); } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={chapter ? `/books/${chapter.bookId}/chapters` : '/books'} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <p className="text-sm text-gray-500">Chapter: {chapter?.title || 'Unknown'}</p>
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium">
          <Plus className="w-4 h-4" /> Add Topic
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editTopic ? 'Edit Topic' : 'Create Topic'}</h2>
            {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl mb-4 text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium">
                {saving ? 'Saving…' : editTopic ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {topicsList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No topics yet</p>
          <p className="text-gray-400 text-sm mt-1">Create the first topic for this chapter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topicsList.map((t, idx) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-semibold text-gray-500">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {t.description && <p className="text-sm text-gray-500 truncate mt-0.5">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Link to={`/topics/${t.id}/edit`} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit content">
                    <Edit3 className="w-4 h-4" />
                  </Link>
                  <button onClick={() => togglePublish(t)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                    {t.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(t)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(t)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
