import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, GripVertical,
  BookOpen, Loader2, ChevronRight, AlertCircle,
} from 'lucide-react';

interface Book {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  order: number;
  createdAt: string;
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [form, setForm] = useState({ title: '', description: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadBooks = () => {
    api.get<Book[]>('/admin/content/books')
      .then(setBooks)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBooks(); }, []);

  const openCreate = () => {
    setEditBook(null);
    setForm({ title: '', description: '', imageUrl: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (book: Book) => {
    setEditBook(book);
    setForm({ title: book.title, description: book.description || '', imageUrl: book.imageUrl || '' });
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editBook) {
        await api.put(`/admin/content/books/${editBook.id}`, form);
      } else {
        await api.post('/admin/content/books', form);
      }
      setShowForm(false);
      loadBooks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (book: Book) => {
    if (!confirm(`Delete "${book.title}"? This will delete all chapters, topics, and content within it.`)) return;
    try {
      await api.delete(`/admin/content/books/${book.id}`);
      loadBooks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const togglePublish = async (book: Book) => {
    try {
      await api.put(`/admin/content/books/${book.id}`, { isPublished: !book.isPublished });
      loadBooks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books</h1>
          <p className="text-gray-500 mt-1">{books.length} books total</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium">
          <Plus className="w-4 h-4" /> Add Book
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editBook ? 'Edit Book' : 'Create Book'}</h2>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl mb-4 text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" placeholder="https://..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium">
                {saving ? 'Saving…' : editBook ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Books List */}
      {books.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No books yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first book to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {books.map((book) => (
            <div key={book.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-4">
                <GripVertical className="w-5 h-5 text-gray-300 cursor-grab flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{book.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${book.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {book.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {book.description && <p className="text-sm text-gray-500 truncate mt-0.5">{book.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Link to={`/books/${book.id}/chapters`} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Manage chapters">
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                  <button onClick={() => togglePublish(book)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title={book.isPublished ? 'Unpublish' : 'Publish'}>
                    {book.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(book)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(book)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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
