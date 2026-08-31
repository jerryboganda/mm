import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Merge,
  BookMarked,
  Building2,
  Tag,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface SourceRef {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
  mcqCount: number;
}

interface InstitutionRef {
  id: string;
  name: string;
  isActive: boolean;
  mcqCount: number;
}

interface Facets {
  years: number[];
  tags: { tag: string; count: number }[];
  examTypes: string[];
  questionTypes: string[];
}

const SOURCE_KINDS: Record<string, string> = {
  textbook: "Textbook",
  past_paper: "Past Paper",
  university_exam: "University Exam",
  board_exam: "Board Exam",
  lecture: "Lecture",
  notes: "Notes",
  custom: "Custom",
};

type Tab = "sources" | "institutions" | "tags";

export default function MetadataPage() {
  const [tab, setTab] = useState<Tab>("sources");
  const [sources, setSources] = useState<SourceRef[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionRef[]>([]);
  const [facets, setFacets] = useState<Facets>({
    years: [],
    tags: [],
    examTypes: [],
    questionTypes: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceKind, setNewSourceKind] = useState("custom");
  const [newInstitutionName, setNewInstitutionName] = useState("");

  const [editing, setEditing] = useState<{
    type: "source" | "institution";
    id: string;
    name: string;
  } | null>(null);
  const [merge, setMerge] = useState<{
    type: "source" | "institution";
    fromId: string;
  } | null>(null);
  const [mergeTo, setMergeTo] = useState("");

  const load = async () => {
    try {
      const [srcs, insts, facetRes] = await Promise.all([
        api.get<SourceRef[]>("/admin/content/sources"),
        api.get<InstitutionRef[]>("/admin/content/institutions"),
        api.get<Facets>("/admin/content/mcqs/facets"),
      ]);
      setSources(srcs);
      setInstitutions(insts);
      setFacets(facetRes);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addSource = async () => {
    if (!newSourceName.trim()) return;
    try {
      await api.post("/admin/content/sources", {
        name: newSourceName.trim(),
        kind: newSourceKind,
      });
      setNewSourceName("");
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const addInstitution = async () => {
    if (!newInstitutionName.trim()) return;
    try {
      await api.post("/admin/content/institutions", {
        name: newInstitutionName.trim(),
      });
      setNewInstitutionName("");
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const rename = async () => {
    if (!editing || !editing.name.trim()) return;
    try {
      const url =
        editing.type === "source"
          ? `/admin/content/sources/${editing.id}`
          : `/admin/content/institutions/${editing.id}`;
      await api.put(url, { name: editing.name.trim() });
      setEditing(null);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleActive = async (
    type: "source" | "institution",
    id: string,
    isActive: boolean,
  ) => {
    try {
      const url =
        type === "source"
          ? `/admin/content/sources/${id}`
          : `/admin/content/institutions/${id}`;
      await api.put(url, { isActive: !isActive });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const remove = async (type: "source" | "institution", id: string) => {
    if (!confirm("Delete this entry? Only allowed when no MCQs reference it."))
      return;
    try {
      const url =
        type === "source"
          ? `/admin/content/sources/${id}`
          : `/admin/content/institutions/${id}`;
      await api.delete(url);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const doMerge = async () => {
    if (!merge || !mergeTo) return;
    try {
      const url =
        merge.type === "source"
          ? "/admin/content/sources/merge"
          : "/admin/content/institutions/merge";
      const res = await api.post<{ message: string }>(url, {
        fromId: merge.fromId,
        toId: mergeTo,
      });
      setMerge(null);
      setMergeTo("");
      alert(res.message);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  const tabs: {
    key: Tab;
    label: string;
    icon: typeof BookMarked;
    count: number;
  }[] = [
    {
      key: "sources",
      label: "Sources / References",
      icon: BookMarked,
      count: sources.length,
    },
    {
      key: "institutions",
      label: "Institutions",
      icon: Building2,
      count: institutions.length,
    },
    { key: "tags", label: "Tags", icon: Tag, count: facets.tags.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">MCQ Metadata</h1>
        <p className="text-gray-500 mt-1">
          Central management of reusable question-bank metadata
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "sources" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center bg-white rounded-2xl border border-gray-100 p-4">
            <input
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSource()}
              placeholder="New source name (e.g., Guyton and Hall Textbook)"
              className="flex-1 min-w-[220px] px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <select
              value={newSourceKind}
              onChange={(e) => setNewSourceKind(e.target.value)}
              className="px-3 py-2 border rounded-xl text-sm bg-white outline-none"
            >
              {Object.entries(SOURCE_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button
              onClick={addSource}
              disabled={!newSourceName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {sources.length === 0 && (
              <p className="p-6 text-sm text-gray-400 text-center">
                No sources yet
              </p>
            )}
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${s.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}
                    title={s.name}
                  >
                    {s.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {SOURCE_KINDS[s.kind] ?? s.kind} · used by {s.mcqCount} MCQs
                    {s.isActive ? "" : " · inactive"}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive("source", s.id, s.isActive)}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"
                  title={s.isActive ? "Deactivate" : "Activate"}
                >
                  {s.isActive ? (
                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setMerge({ type: "source", fromId: s.id })}
                  className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                  title="Merge into another source"
                >
                  <Merge className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setEditing({ type: "source", id: s.id, name: s.name })
                  }
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Rename"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove("source", s.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete (only if unused)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "institutions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center bg-white rounded-2xl border border-gray-100 p-4">
            <input
              value={newInstitutionName}
              onChange={(e) => setNewInstitutionName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addInstitution()}
              placeholder="New institution / university name"
              className="flex-1 min-w-[220px] px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <button
              onClick={addInstitution}
              disabled={!newInstitutionName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {institutions.length === 0 && (
              <p className="p-6 text-sm text-gray-400 text-center">
                No institutions yet
              </p>
            )}
            {institutions.map((i) => (
              <div key={i.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${i.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}
                  >
                    {i.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    used by {i.mcqCount} MCQs{i.isActive ? "" : " · inactive"}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive("institution", i.id, i.isActive)}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"
                  title={i.isActive ? "Deactivate" : "Activate"}
                >
                  {i.isActive ? (
                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() =>
                    setMerge({ type: "institution", fromId: i.id })
                  }
                  className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                  title="Merge into another institution"
                >
                  <Merge className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setEditing({ type: "institution", id: i.id, name: i.name })
                  }
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Rename"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove("institution", i.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete (only if unused)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "tags" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500 mb-3">
            Tags are normalized automatically (case-insensitive, trimmed) when
            MCQs are saved. Rename or merge tags from the MCQ edit screen.
          </p>
          {facets.tags.length === 0 ? (
            <p className="p-6 text-sm text-gray-400 text-center">
              No tags in use yet
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {facets.tags.map((t) => (
                <span
                  key={t.tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-700"
                >
                  #{t.tag}
                  <span className="text-xs text-gray-400">{t.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rename modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                Rename {editing.type === "source" ? "Source" : "Institution"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Renaming updates everywhere instantly — MCQs keep their link.
            </p>
            <input
              autoFocus
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && rename()}
              className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={rename}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge modal */}
      {merge && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setMerge(null);
            setMergeTo("");
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Merge duplicates</h2>
              <button
                onClick={() => {
                  setMerge(null);
                  setMergeTo("");
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              All MCQs attached to the selected entry will be reassigned to the
              target, then the duplicate is removed.
            </p>
            <select
              value={merge.fromId}
              onChange={(e) => setMerge({ ...merge, fromId: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm bg-white mb-3 outline-none"
            >
              {(merge.type === "source" ? sources : institutions).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.mcqCount} MCQs)
                </option>
              ))}
            </select>
            <select
              value={mergeTo}
              onChange={(e) => setMergeTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm bg-white outline-none"
            >
              <option value="">Merge into…</option>
              {(merge.type === "source" ? sources : institutions)
                .filter((x) => x.id !== merge.fromId)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setMerge(null);
                  setMergeTo("");
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={doMerge}
                disabled={!mergeTo}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-medium"
              >
                <Merge className="w-4 h-4" /> Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
