import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  AlertCircle,
  FileText,
  Edit3,
  Clock,
} from "lucide-react";

interface Subtopic {
  id: string;
  topicId: string;
  title: string;
  description: string | null;
  order: number;
  isPublished: boolean;
  isPaid: boolean;
  estimatedMinutes: number;
}

interface Topic {
  id: string;
  title: string;
  bookId: string | null;
  chapterId: string | null;
  isPublished: boolean;
}

export default function SubtopicsPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [subtopicsList, setSubtopics] = useState<Subtopic[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSubtopic, setEditSubtopic] = useState<Subtopic | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    estimatedMinutes: 3,
    isPublished: true,
    isPaid: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [st, t] = await Promise.all([
        api.get<Subtopic[]>(`/admin/content/topics/${topicId}/subtopics`),
        api.get<Topic>(`/admin/content/topics/${topicId}`),
      ]);
      setSubtopics(st);
      setTopic(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [topicId]);

  const openCreate = () => {
    setEditSubtopic(null);
    setForm({
      title: "",
      description: "",
      estimatedMinutes: 3,
      isPublished: true,
      isPaid: false,
    });
    setShowForm(true);
    setError("");
  };

  const openEdit = (s: Subtopic) => {
    setEditSubtopic(s);
    setForm({
      title: s.title,
      description: s.description || "",
      estimatedMinutes: s.estimatedMinutes || 3,
      isPublished: s.isPublished,
      isPaid: s.isPaid ?? false,
    });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editSubtopic) {
        await api.put(`/admin/content/subtopics/${editSubtopic.id}`, form);
      } else {
        await api.post("/admin/content/subtopics", {
          ...form,
          topicId,
        });
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Subtopic) => {
    if (
      !confirm(
        `Delete "${s.title}"? All content blocks within this subtopic will be permanently removed.`,
      )
    )
      return;
    try {
      await api.delete(`/admin/content/subtopics/${s.id}`);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const togglePublish = async (s: Subtopic) => {
    try {
      await api.put(`/admin/content/subtopics/${s.id}`, {
        isPublished: !s.isPublished,
      });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const backLink = topic?.bookId
    ? `/books/${topic.bookId}/topics`
    : topic?.chapterId
      ? `/chapters/${topic.chapterId}/topics`
      : "/books";

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={backLink}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          title="Back to Topics"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <p className="text-sm text-gray-500">
            Topic: {topic?.title || "Loading..."}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Subtopics</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" /> Add Subtopic
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">
              {editSubtopic ? "Edit Subtopic" : "Create Subtopic"}
            </h2>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl mb-4 text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="e.g. Overview, Clinical Features, Diagnosis..."
                />
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
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  placeholder="Short summary of this subtopic section..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Reading Minutes
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={form.estimatedMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estimatedMinutes: parseInt(e.target.value) || 3,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPaid}
                  onChange={(e) =>
                    setForm({ ...form, isPaid: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    Paid Content (Requires Premium Subscription)
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Locked for free users; requires an active subscription
                  </span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm({ ...form, isPublished: e.target.checked })
                  }
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Published</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {saving ? "Saving…" : editSubtopic ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {subtopicsList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No subtopics yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Create subtopics to break down this topic into bite-sized learning sections
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {subtopicsList.map((s, idx) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 bg-primary-50 text-primary-700 rounded-lg flex items-center justify-center text-sm font-semibold">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {s.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      <Clock className="w-3 h-3" />
                      {s.estimatedMinutes || 3} min
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.isPaid ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}
                    >
                      {s.isPaid ? "Paid" : "Free"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {s.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  {s.description && (
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {s.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/subtopics/${s.id}/edit`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                    title="Edit content blocks"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Content</span>
                  </Link>
                  <button
                    onClick={() => togglePublish(s)}
                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title={s.isPublished ? "Unpublish subtopic" : "Publish subtopic"}
                  >
                    {s.isPublished ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit metadata"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete subtopic"
                  >
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
