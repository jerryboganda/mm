import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import BlockEditor, { ContentBlock } from '../components/BlockEditor';
import {
  Plus, Pencil, Trash2, Eye, Globe, Search, Upload,
  Loader2, AlertCircle, ClipboardList, X, Download, CheckCircle2, Check,
} from 'lucide-react';

function parseExplanationToBlocks(explanationStr: string | null | undefined): ContentBlock[] {
  if (!explanationStr || !explanationStr.trim()) {
    return [{ id: `block-${Date.now()}-0`, type: 'text', content: '', order: 0 }];
  }
  const trimmed = explanationStr.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((b: any, idx: number) => ({
          id: b.id || `block-${Date.now()}-${idx}`,
          type: b.type || 'text',
          content: b.content || '',
          order: typeof b.order === 'number' ? b.order : idx,
        }));
      }
    } catch {
      // Fallback to text block if JSON parsing fails
    }
  }
  return [{ id: `block-${Date.now()}-0`, type: 'text', content: explanationStr, order: 0 }];
}

function serializeBlocksToExplanation(blocks: ContentBlock[]): string {
  const activeBlocks = blocks.filter((b) => {
    if (!b.content) return false;
    if (b.type === 'text' || b.type === 'html') {
      return b.content.replace(/<[^>]*>/g, '').trim().length > 0;
    }
    return b.content.trim().length > 0;
  });

  if (activeBlocks.length === 0) return '';
  if (activeBlocks.length === 1 && (activeBlocks[0].type === 'text' || activeBlocks[0].type === 'html')) {
    return activeBlocks[0].content;
  }
  return JSON.stringify(activeBlocks);
}

interface MCQ {
  id: string;
  topicId: string;
  question: string;
  options: any;
  correctAnswer: string;
  explanation: string | null;
  difficulty: string;
  isPublished: boolean;
  isPaid: boolean;
  createdAt: string;
}

interface TopicRef {
  id: string;
  title: string;
  chapterTitle: string;
  bookTitle: string;
}

export default function McqsPage() {
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [total, setTotal] = useState(0);
  const [topicsList, setTopics] = useState<TopicRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterPaid, setFilterPaid] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editMcq, setEditMcq] = useState<MCQ | null>(null);
  const [previewMcq, setPreviewMcq] = useState<MCQ | null>(null);
  const [form, setForm] = useState({
    topicId: '',
    question: '',
    optA: '', optB: '', optC: '', optD: '', optE: '',
    correctAnswer: 'A',
    explanation: '',
    explanationBlocks: [] as ContentBlock[],
    explA: '', explB: '', explC: '', explD: '', explE: '',
    difficulty: 'medium',
    references: '',
    tags: '',
    isPaid: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Bulk import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importTopicId, setImportTopicId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const result = await api.upload<{ url: string }>('/admin/content/uploads/images', formData);
    return result.url;
  };

  const load = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (filterTopic) params.set('topicId', filterTopic);
      if (filterDifficulty) params.set('difficulty', filterDifficulty);
      if (filterPaid) params.set('isPaid', filterPaid);

      const [result, topics] = await Promise.all([
        api.get<{ data: MCQ[]; total: number }>(`/admin/content/mcqs?${params}`),
        topicsList.length === 0 ? api.get<TopicRef[]>('/admin/content/topics/all') : Promise.resolve(topicsList),
      ]);
      setMcqs(result.data);
      setTotal(result.total);
      if (Array.isArray(topics)) setTopics(topics);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search, filterTopic, filterDifficulty, filterPaid]);

  const openCreate = () => {
    setEditMcq(null);
    setForm({
      topicId: filterTopic || '', question: '', optA: '', optB: '', optC: '', optD: '', optE: '',
      correctAnswer: 'A', explanation: '', explanationBlocks: parseExplanationToBlocks(''), explA: '', explB: '', explC: '', explD: '', explE: '',
      difficulty: 'medium', references: '', tags: '', isPaid: false,
    });
    setShowForm(true);
    setError('');
  };

  const openEdit = (m: MCQ) => {
    const opts = m.options as Record<string, string>;
    const optExpls = (m as any).optionExplanations as Record<string, string> | null;
    setEditMcq(m);
    setForm({
      topicId: m.topicId,
      question: m.question,
      optA: opts?.A || '', optB: opts?.B || '', optC: opts?.C || '', optD: opts?.D || '', optE: opts?.E || '',
      correctAnswer: m.correctAnswer,
      explanation: m.explanation || '',
      explanationBlocks: parseExplanationToBlocks(m.explanation),
      explA: optExpls?.A || '', explB: optExpls?.B || '', explC: optExpls?.C || '', explD: optExpls?.D || '', explE: optExpls?.E || '',
      difficulty: m.difficulty,
      references: (m as any).references || '',
      tags: Array.isArray((m as any).tags) ? (m as any).tags.join(', ') : '',
      isPaid: m.isPaid ?? false,
    });
    setShowForm(true);
    setError('');
  };

  const buildMcqPayload = () => {
    const options: Record<string, string> = {};
    if (form.optA) options.A = form.optA;
    if (form.optB) options.B = form.optB;
    if (form.optC) options.C = form.optC;
    if (form.optD) options.D = form.optD;
    if (form.optE) options.E = form.optE;

    const optionExplanations: Record<string, string> = {};
    if (form.explA) optionExplanations.A = form.explA;
    if (form.explB) optionExplanations.B = form.explB;
    if (form.explC) optionExplanations.C = form.explC;
    if (form.explD) optionExplanations.D = form.explD;
    if (form.explE) optionExplanations.E = form.explE;

    return {
      topicId: form.topicId,
      question: form.question,
      options,
      correctAnswer: form.correctAnswer,
      explanation: serializeBlocksToExplanation(form.explanationBlocks) || undefined,
      optionExplanations: Object.keys(optionExplanations).length > 0 ? optionExplanations : undefined,
      difficulty: form.difficulty,
      references: form.references || undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      isPublished: true,
      isPaid: form.isPaid,
    };
  };

  const handleSave = async () => {
    if (!form.topicId || !form.question || !form.optA || !form.optB) {
      setError('Topic, question, and at least 2 options required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildMcqPayload();
      if (editMcq) {
        await api.put(`/admin/content/mcqs/${editMcq.id}`, payload);
      } else {
        await api.post('/admin/content/mcqs', payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: MCQ) => {
    if (!confirm('Delete this MCQ?')) return;
    try { await api.delete(`/admin/content/mcqs/${m.id}`); load(); } catch (err: any) { alert(err.message); }
  };

  const togglePublish = async (m: MCQ) => {
    try { await api.put(`/admin/content/mcqs/${m.id}`, { isPublished: !m.isPublished }); load(); } catch (err: any) { alert(err.message); }
  };

  // ── Bulk Import ──
  const handleBulkImport = async () => {
    if (!importTopicId) { setImportResult('❌ Select a topic first'); return; }
    setImporting(true);
    setImportResult('');
    try {
      let mcqList: any[] = [];

      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(importText);
        mcqList = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Parse as CSV: question,optA,optB,optC,optD,correct,explanation,difficulty
        const lines = importText.trim().split('\n').filter((l) => l.trim());
        const startIdx = lines[0]?.toLowerCase().includes('question') ? 1 : 0; // skip header
        for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());
          if (cols.length < 5) continue;
          mcqList.push({
            question: cols[0],
            options: { A: cols[1], B: cols[2], C: cols[3], D: cols[4] || '' },
            correctAnswer: cols[5] || 'A',
            explanation: cols[6] || '',
            difficulty: cols[7] || 'medium',
          });
        }
      }

      if (mcqList.length === 0) { setImportResult('❌ No valid MCQs found'); setImporting(false); return; }

      // Attach topicId
      mcqList = mcqList.map((m) => ({
        ...m,
        topicId: importTopicId,
        options: m.options || { A: m.optA, B: m.optB, C: m.optC, D: m.optD },
        correctAnswer: m.correctAnswer || m.correct || 'A',
        difficulty: m.difficulty || 'medium',
        isPublished: m.isPublished !== undefined ? m.isPublished : true,
      }));

      const res = await api.post<{ count: number }>('/admin/content/mcqs/bulk', { mcqs: mcqList });
      setImportResult(`✅ Successfully imported ${res.count} MCQs!`);
      setImportText('');
      load();
    } catch (err: any) {
      setImportResult(`❌ Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  if (loading && mcqs.length === 0) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MCQs</h1>
          <p className="text-gray-500 mt-1">{total} questions total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(true); setImportResult(''); }} className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors font-medium">
            <Upload className="w-4 h-4" /> Bulk Import
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium">
            <Plus className="w-4 h-4" /> Add MCQ
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search questions…"
            className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          />
        </div>
        <select value={filterTopic} onChange={(e) => { setFilterTopic(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">All Topics</option>
          {topicsList.map((t) => <option key={t.id} value={t.id}>{t.bookTitle} › {t.title}</option>)}
        </select>
        <select value={filterDifficulty} onChange={(e) => { setFilterDifficulty(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">All Difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select value={filterPaid} onChange={(e) => { setFilterPaid(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">All Access Types</option>
          <option value="false">Free Questions</option>
          <option value="true">Paid Questions</option>
        </select>
      </div>

      {/* MCQ Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editMcq ? 'Edit MCQ' : 'Create MCQ'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl mb-4 text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic *</label>
                <select value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Select topic…</option>
                  {topicsList.map((t) => <option key={t.id} value={t.id}>{t.bookTitle} › {t.chapterTitle} › {t.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question *</label>
                <textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none resize-none text-sm" />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPaid}
                  onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Paid Question (Requires Premium Subscription)</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    If checked, users must have an active premium subscription to attempt or view this question.
                  </span>
                </span>
              </label>
              {['A', 'B', 'C', 'D', 'E'].map((opt) => (
                <div key={opt} className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Option {opt} {opt <= 'B' ? '*' : ''}</label>
                    <input value={(form as any)[`opt${opt}`]} onChange={(e) => setForm({ ...form, [`opt${opt}`]: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Explanation {opt}</label>
                    <input value={(form as any)[`expl${opt}`]} onChange={(e) => setForm({ ...form, [`expl${opt}`]: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Why this is right/wrong" />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer *</label>
                  <select value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                    {['A', 'B', 'C', 'D', 'E'].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">
                  General Explanation (Rich Text / Tables / Diagrams / Formulas / Images)
                </label>
                <BlockEditor
                  blocks={form.explanationBlocks}
                  onChange={(blocks) => setForm((prev) => ({ ...prev, explanationBlocks: blocks }))}
                  uploadImage={uploadImage}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">References</label>
                  <input value={form.references} onChange={(e) => setForm({ ...form, references: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="e.g., hypertension, pregnancy" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium">
                {saving ? 'Saving…' : editMcq ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Bulk Import MCQs</h2>
              <button onClick={() => setShowImport(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Topic *</label>
                <select value={importTopicId} onChange={(e) => setImportTopicId(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Select topic…</option>
                  {topicsList.map((t) => <option key={t.id} value={t.id}>{t.bookTitle} › {t.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paste CSV or JSON
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none font-mono"
                  placeholder={`CSV format:\nquestion,optA,optB,optC,optD,correctAnswer,explanation,difficulty\n"What is X?","Answer A","Answer B","Answer C","Answer D","A","Because...","medium"\n\nOR JSON format:\n[{"question":"What is X?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"A"}]`}
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-xl text-sm text-blue-700">
                <p className="font-medium mb-1">Supported Formats:</p>
                <p>• <strong>CSV</strong>: question, optA, optB, optC, optD, correct, explanation, difficulty</p>
                <p>• <strong>JSON</strong>: Array of objects with question, options, correctAnswer, etc.</p>
                <p>• Tab-separated values also supported</p>
              </div>

              {importResult && (
                <div className={`p-3 rounded-xl text-sm ${importResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {importResult}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleBulkImport} disabled={importing || !importText.trim()} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-medium">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MCQ Preview Modal */}
      {previewMcq && (() => {
        const opts = (previewMcq.options || {}) as Record<string, string>;
        const optExpls = ((previewMcq as any).optionExplanations || {}) as Record<string, string>;
        const explanationBlocks = parseExplanationToBlocks(previewMcq.explanation);
        const topicRef = topicsList.find((t) => t.id === previewMcq.topicId);
        const rawTags = (previewMcq as any).tags;
        const tags = Array.isArray(rawTags)
          ? rawTags
          : typeof rawTags === 'string' && rawTags
          ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [];
        const references = (previewMcq as any).references;

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setPreviewMcq(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8 flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">MCQ Preview</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${previewMcq.isPaid ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                      {previewMcq.isPaid ? 'Paid' : 'Free'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${previewMcq.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {previewMcq.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${previewMcq.difficulty === 'easy' ? 'bg-blue-100 text-blue-700' : previewMcq.difficulty === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {previewMcq.difficulty}
                    </span>
                  </div>
                  {topicRef && (
                    <p className="text-xs text-gray-500">
                      {topicRef.bookTitle} › {topicRef.chapterTitle} › <span className="font-medium text-gray-700">{topicRef.title}</span>
                    </p>
                  )}
                </div>
                <button onClick={() => setPreviewMcq(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-6 overflow-y-auto py-4 pr-1 flex-1">
                {/* Question */}
                <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Question</span>
                  <p className="text-base font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">{previewMcq.question}</p>
                </div>

                {/* Options List */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2.5">Options & Explanations</span>
                  <div className="space-y-2.5">
                    {['A', 'B', 'C', 'D', 'E'].map((key) => {
                      const optText = opts[key];
                      if (!optText) return null;
                      const isCorrect = previewMcq.correctAnswer === key;
                      const expl = optExpls[key];

                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-3 transition-all ${
                            isCorrect
                              ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300/50'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {key}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm ${isCorrect ? 'font-semibold text-emerald-950' : 'text-gray-800'}`}>
                                  {optText}
                                </p>
                                {isCorrect && (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                    <Check className="w-3.5 h-3.5" /> Correct Answer
                                  </span>
                                )}
                              </div>
                              {expl && (
                                <div className="mt-2 text-xs text-gray-600 bg-gray-50/90 rounded-lg p-2 border border-gray-100">
                                  <span className="font-semibold text-gray-700">Option {key} Explanation: </span>
                                  {expl}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* General Explanation */}
                {explanationBlocks.some((b) => b.content && b.content.trim()) && (
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">General Explanation</span>
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
                      {explanationBlocks.map((b) => {
                        if (!b.content || !b.content.trim()) return null;
                        if (b.type === 'image') {
                          return (
                            <div key={b.id} className="text-center my-2">
                              <img src={b.content} alt="Explanation diagram" className="max-h-72 max-w-full rounded-lg border border-gray-200 shadow-sm mx-auto object-contain" />
                            </div>
                          );
                        }
                        if (b.type === 'callout') {
                          return (
                            <div key={b.id} className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg text-sm text-amber-900">
                              <div dangerouslySetInnerHTML={{ __html: b.content }} />
                            </div>
                          );
                        }
                        return (
                          <div
                            key={b.id}
                            className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: b.content }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* References & Tags */}
                {(references || (tags && tags.length > 0)) && (
                  <div className="pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {references && (
                      <div>
                        <span className="font-semibold text-gray-500 block mb-0.5">References:</span>
                        <p className="text-gray-700">{references}</p>
                      </div>
                    )}
                    {tags && tags.length > 0 && (
                      <div>
                        <span className="font-semibold text-gray-500 block mb-1">Tags:</span>
                        <div className="flex flex-wrap gap-1">
                          {tags.map((t: string, idx: number) => (
                            <span key={idx} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[11px]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-shrink-0 mt-2">
                <button
                  onClick={() => {
                    const target = previewMcq;
                    setPreviewMcq(null);
                    openEdit(target);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors"
                >
                  <Pencil className="w-4 h-4" /> Edit this MCQ
                </button>
                <button
                  onClick={() => setPreviewMcq(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MCQ List */}
      {mcqs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No MCQs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mcqs.map((m) => {
            const opts = m.options as Record<string, string>;
            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.isPaid ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                        {m.isPaid ? 'Paid' : 'Free'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {m.isPublished ? 'Published' : 'Draft'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.difficulty === 'easy' ? 'bg-blue-100 text-blue-700' : m.difficulty === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {m.difficulty}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{m.question}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Correct: {m.correctAnswer} • Options: {Object.keys(opts).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setPreviewMcq(m)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Preview MCQ"
                      aria-label="Preview MCQ"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => togglePublish(m)}
                      className={`p-2 rounded-lg transition-colors ${
                        m.isPublished
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      title={m.isPublished ? 'Published — Click to make Draft' : 'Draft — Click to Publish'}
                      aria-label={m.isPublished ? 'Published — Click to make Draft' : 'Draft — Click to Publish'}
                    >
                      <Globe className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(m)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit MCQ"
                      aria-label="Edit MCQ"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete MCQ"
                      aria-label="Delete MCQ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50">Previous</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
