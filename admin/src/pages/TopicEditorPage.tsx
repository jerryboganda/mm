import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import BlockEditor, { ContentBlock, normalizeBlockOrder } from "../components/BlockEditor";
import ImportedDocumentBlock from "../components/ImportedDocumentBlock";
import MobileContentPreview from "../components/MobileContentPreview";
import {
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ContentDetail {
  id: string;
  title: string;
  description?: string | null;
  chapterId?: string | null;
  bookId?: string | null;
  topicId?: string | null;
  isPublished?: boolean;
  isPaid?: boolean;
}

interface UploadResponse {
  url: string;
  filename: string;
}

export default function TopicEditorPage() {
  const { topicId, subtopicId } = useParams<{ topicId?: string; subtopicId?: string }>();
  const [contentItem, setContentItem] = useState<ContentDetail | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");

  // Local state for editing
  const [localBlocks, setLocalBlocks] = useState<ContentBlock[]>([]);
  const richTextHtmlGettersRef = useRef(new Map<string, () => string>());

  const load = useCallback(async () => {
    try {
      if (subtopicId) {
        const [st, bs] = await Promise.all([
          api.get<ContentDetail>(`/admin/content/subtopics/${subtopicId}`),
          api.get<ContentBlock[]>(`/admin/content/subtopics/${subtopicId}/blocks`),
        ]);
        setContentItem(st);
        setBlocks(bs);
        setLocalBlocks(normalizeBlockOrder(bs));
      } else if (topicId) {
        const [t, bs] = await Promise.all([
          api.get<ContentDetail>(`/admin/content/topics/${topicId}`),
          api.get<ContentBlock[]>(`/admin/content/topics/${topicId}/blocks`),
        ]);
        setContentItem(t);
        setBlocks(bs);
        setLocalBlocks(normalizeBlockOrder(bs));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [topicId, subtopicId]);

  useEffect(() => {
    load();
  }, [load]);

  const registerRichTextHtmlGetter = useCallback(
    (id: string, getter: (() => string) | null) => {
      if (getter) {
        richTextHtmlGettersRef.current.set(id, getter);
      } else {
        richTextHtmlGettersRef.current.delete(id);
      }
    },
    [],
  );

  const collectLiveBlocks = useCallback(() => {
    return normalizeBlockOrder(
      localBlocks.map((block) => {
        if (block.type !== "text" && block.type !== "html") return block;

        const getHtml = richTextHtmlGettersRef.current.get(block.id);
        if (!getHtml) return block;

        const content = getHtml();
        return content === block.content ? block : { ...block, content };
      }),
    );
  }, [localBlocks]);

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const result = await api.upload<UploadResponse>(
      "/admin/content/uploads/images",
      formData,
    );
    return result.url;
  };

  const saveAll = async () => {
    setSaving(true);
    setError("");
    try {
      const blocksForSave = collectLiveBlocks();
      setLocalBlocks(blocksForSave);

      // Collect only changed blocks
      const changedBlocks = blocksForSave
        .filter((block) => {
          const original = blocks.find((b) => b.id === block.id);
          return (
            !original ||
            original.content !== block.content ||
            original.type !== block.type
          );
        })
        .map((b) => ({ id: b.id, content: b.content, type: b.type }));

      const orderedIds = blocksForSave.map((b) => b.id);

      // Single batch request instead of N+1 calls
      await api.post("/admin/content/blocks/batch-save", {
        blocks: changedBlocks,
        topicId: subtopicId ? undefined : topicId,
        subtopicId: subtopicId || undefined,
        orderedIds,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = async () => {
    if (!contentItem) return;
    try {
      const newPaid = !contentItem.isPaid;
      if (subtopicId) {
        await api.put(`/admin/content/subtopics/${subtopicId}`, { isPaid: newPaid });
      } else if (topicId) {
        await api.put(`/admin/content/topics/${topicId}`, { isPaid: newPaid });
      }
      setContentItem((prev) => (prev ? { ...prev, isPaid: newPaid } : null));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  const backLink = subtopicId
    ? `/topics/${contentItem?.topicId}/subtopics`
    : contentItem?.bookId
      ? `/books/${contentItem.bookId}/topics`
      : contentItem?.chapterId
        ? `/chapters/${contentItem.chapterId}/topics`
        : "/books";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={backLink}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">
              {subtopicId ? "Subtopic Content Editor" : "Topic Content Editor"}
            </p>
            {contentItem && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  contentItem.isPaid
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-green-100 text-green-800 border border-green-200"
                }`}
              >
                {contentItem.isPaid ? "Paid Content" : "Free Content"}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {contentItem?.title || "Loading..."}
          </h1>
        </div>
        {contentItem && (
          <button
            type="button"
            onClick={togglePaid}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              contentItem.isPaid
                ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
            title="Toggle Paid / Free status"
          >
            {contentItem.isPaid ? "Make Free" : "Make Paid"}
          </button>
        )}
        {!localBlocks.some((b) => (b.type as string) === "document_html") && (
          <button
            onClick={saveAll}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              saved
                ? "bg-green-100 text-green-700"
                : "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : saved ? "Saved" : "Save All"}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Content Blocks */}
        <div>
          {localBlocks.some((b) => (b.type as string) === "document_html") ? (
            <div className="space-y-4">
              {localBlocks.map((block) => (
                <ImportedDocumentBlock
                  key={block.id}
                  block={block}
                  topicId={topicId || subtopicId || ""}
                />
              ))}
            </div>
          ) : (
            <BlockEditor
              blocks={localBlocks}
              onChange={setLocalBlocks}
              uploadImage={uploadImage}
              registerHtmlGetter={registerRichTextHtmlGetter}
              onAddBlockRemote={async (type, _insertIndex) =>
                api.post("/admin/content/blocks", {
                  topicId: subtopicId ? undefined : topicId,
                  subtopicId: subtopicId || undefined,
                  type,
                  content: "",
                })
              }
              onDeleteBlockRemote={async (id) =>
                api.delete(`/admin/content/blocks/${id}`)
              }
            />
          )}
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <MobileContentPreview
            title={contentItem?.title || "Content preview"}
            blocks={localBlocks}
            theme={previewTheme}
            onThemeChange={setPreviewTheme}
          />
        </div>
      </div>
    </div>
  );
}
