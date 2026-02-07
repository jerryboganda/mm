import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import TipTapEditor from '../components/TipTapEditor';
import {
  Plus, Trash2, Save, ArrowLeft, Loader2, AlertCircle,
  GripVertical, ChevronUp, ChevronDown, Type, Code, Image,
} from 'lucide-react';

interface ContentBlock {
  id: string;
  topicId: string;
  type: string;
  content: string;
  order: number;
}

interface TopicDetail {
  id: string;
  title: string;
  description: string | null;
  chapterId: string;
}

type BlockType = 'text' | 'heading' | 'code' | 'image' | 'html';

const BLOCK_TYPES: { value: BlockType; label: string; icon: any }[] = [
  { value: 'text', label: 'Rich Text', icon: Type },
  { value: 'heading', label: 'Heading', icon: Type },
  { value: 'code', label: 'Code', icon: Code },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'html', label: 'HTML', icon: Code },
];

export default function TopicEditorPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Local state for editing
  const [localBlocks, setLocalBlocks] = useState<ContentBlock[]>([]);
  const [newBlockType, setNewBlockType] = useState<BlockType>('text');

  const load = useCallback(async () => {
    try {
      const [t, bs] = await Promise.all([
        api.get<TopicDetail>(`/admin/content/topics/${topicId}`),
        api.get<ContentBlock[]>(`/admin/content/topics/${topicId}/blocks`),
      ]);
      setTopic(t);
      setBlocks(bs);
      setLocalBlocks(bs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  const updateBlock = (id: string, content: string) => {
    setLocalBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
    setSaved(false);
  };

  const addBlock = async () => {
    try {
      const newBlock = await api.post<ContentBlock>('/admin/content/blocks', {
        topicId,
        type: newBlockType,
        content: '',
      });
      setLocalBlocks((prev) => [...prev, newBlock]);
      setSaved(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteBlock = async (blockId: string) => {
    if (!confirm('Delete this content block?')) return;
    try {
      await api.delete(`/admin/content/blocks/${blockId}`);
      setLocalBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...localBlocks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    setLocalBlocks(newBlocks);
    setSaved(false);
  };

  const saveAll = async () => {
    setSaving(true);
    setError('');
    try {
      // Save each block content
      for (const block of localBlocks) {
        const original = blocks.find((b) => b.id === block.id);
        if (!original || original.content !== block.content) {
          await api.put(`/admin/content/blocks/${block.id}`, {
            content: block.content,
            type: block.type,
          });
        }
      }
      // Reorder
      const orderedIds = localBlocks.map((b) => b.id);
      await api.post('/admin/content/blocks/reorder', { topicId, orderedIds });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={topic ? `/chapters/${topic.chapterId}/topics` : '/books'} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <p className="text-sm text-gray-500">Topic Content Editor</p>
          <h1 className="text-xl font-bold text-gray-900">{topic?.title || 'Loading…'}</h1>
        </div>
        <button
          onClick={saveAll}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            saved
              ? 'bg-green-100 text-green-700'
              : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50'
          }`}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save All'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Content Blocks */}
      <div className="space-y-4">
        {localBlocks.map((block, idx) => (
          <div key={block.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
            {/* Block header */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <GripVertical className="w-4 h-4 text-gray-300" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {block.type}
              </span>
              <span className="text-xs text-gray-400">Block {idx + 1}</span>
              <div className="flex-1" />
              <button onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={() => moveBlock(idx, 'down')} disabled={idx === localBlocks.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <ChevronDown className="w-4 h-4" />
              </button>
              <button onClick={() => deleteBlock(block.id)} className="p-1 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Block content */}
            <div className="p-0">
              {block.type === 'text' || block.type === 'html' ? (
                <TipTapEditor
                  content={block.content}
                  onChange={(html) => updateBlock(block.id, html)}
                  placeholder="Write content here…"
                />
              ) : block.type === 'image' ? (
                <div className="p-4 space-y-2">
                  <input
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, e.target.value)}
                    placeholder="Enter image URL…"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  />
                  {block.content && (
                    <img src={block.content} alt="Preview" className="max-h-48 rounded-lg object-contain" />
                  )}
                </div>
              ) : (
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  rows={block.type === 'heading' ? 2 : 6}
                  placeholder={block.type === 'heading' ? 'Enter heading text…' : 'Enter content…'}
                  className="w-full px-4 py-3 outline-none resize-none font-mono text-sm"
                />
              )}
            </div>
          </div>
        ))}

        {/* Add new block */}
        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-dashed border-gray-300 hover:border-primary-400 transition-colors">
          <select
            value={newBlockType}
            onChange={(e) => setNewBlockType(e.target.value as BlockType)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            {BLOCK_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>
          <button
            onClick={addBlock}
            className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Block
          </button>
        </div>
      </div>
    </div>
  );
}
