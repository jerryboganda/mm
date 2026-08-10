import { useState, useRef } from "react";
import TipTapEditor from "./TipTapEditor";
import MermaidEditor from "./MermaidEditor";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Type,
  Code,
  Image as ImageIcon,
  GitBranch,
  Upload,
  X,
  Loader2,
} from "lucide-react";

export interface ContentBlock {
  id: string;
  topicId?: string;
  type: string;
  content: string;
  order: number;
}

export type BlockType = "text" | "heading" | "code" | "image" | "html" | "diagram";

export const BLOCK_TYPES: { value: BlockType; label: string; icon: any }[] = [
  { value: "text", label: "Rich Text", icon: Type },
  { value: "heading", label: "Heading", icon: Type },
  { value: "code", label: "Code", icon: Code },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "html", label: "HTML", icon: Code },
  { value: "diagram", label: "Flowchart / Diagram", icon: GitBranch },
];

export function normalizeBlockOrder(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block, index) => ({ ...block, order: index }));
}

function AddBlockControl({
  label,
  blockType,
  onBlockTypeChange,
  onAdd,
  compact = false,
}: {
  label: string;
  blockType: BlockType;
  onBlockTypeChange: (type: BlockType) => void;
  onAdd: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white transition-colors hover:border-primary-400 ${
        compact ? "px-3 py-2" : "p-4"
      }`}
    >
      <select
        value={blockType}
        onChange={(e) => onBlockTypeChange(e.target.value as BlockType)}
        className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
      >
        {BLOCK_TYPES.map((bt) => (
          <option key={bt.value} value={bt.value}>
            {bt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
      >
        <Plus className="w-4 h-4" /> {label}
      </button>
    </div>
  );
}

function ImageBlockEditor({
  value,
  onChange,
  uploadImage,
}: {
  value: string;
  onChange: (content: string) => void;
  uploadImage: (file: File) => Promise<string>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
      setDragging(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const firstImageFile = (files?: FileList | null) =>
    Array.from(files || []).find((file) => file.type.startsWith("image/"));

  return (
    <div className="p-4 space-y-3">
      <div
        onPaste={(event) => {
          const file = firstImageFile(event.clipboardData?.files);
          if (!file) return;
          event.preventDefault();
          void uploadFile(file);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const file = firstImageFile(event.dataTransfer.files);
          if (file) void uploadFile(file);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        tabIndex={0}
        className={`rounded-xl border border-dashed p-5 text-center outline-none transition-colors ${
          dragging
            ? "border-primary-400 bg-primary-50"
            : "border-gray-300 bg-gray-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        }`}
      >
        <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">
          Paste, drop, or choose an image
        </p>
        <p className="mt-1 text-xs text-gray-500">
          JPEG, PNG, WebP, or GIF up to 10 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = firstImageFile(event.target.files);
            if (file) void uploadFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Uploading..." : "Choose Image"}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste an image URL..."
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-lg border px-3 text-gray-500 hover:bg-gray-50 hover:text-red-600"
            title="Clear image"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {value && (
        <img
          src={value}
          alt="Preview"
          className="max-h-64 w-full rounded-lg object-contain"
        />
      )}
    </div>
  );
}

export interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  uploadImage: (file: File) => Promise<string>;
  registerHtmlGetter?: (id: string, getter: (() => string) | null) => void;
  onAddBlockRemote?: (type: BlockType, insertIndex: number) => Promise<any>;
  onDeleteBlockRemote?: (id: string) => Promise<void>;
}

export default function BlockEditor({
  blocks,
  onChange,
  uploadImage,
  registerHtmlGetter,
  onAddBlockRemote,
  onDeleteBlockRemote,
}: BlockEditorProps) {
  const [newBlockType, setNewBlockType] = useState<BlockType>("text");

  const updateBlock = (id: string, content: string) => {
    onChange(
      blocks.map((b) => (b.id === id ? { ...b, content } : b)),
    );
  };

  const addBlock = async (insertIndex = blocks.length) => {
    try {
      let newBlock: ContentBlock;
      if (onAddBlockRemote) {
        const res = await onAddBlockRemote(newBlockType, insertIndex);
        if (res && typeof res === "object" && res.id) {
          newBlock = res;
        } else {
          newBlock = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            type: newBlockType,
            content: "",
            order: insertIndex,
          };
        }
      } else {
        newBlock = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: newBlockType,
          content: "",
          order: insertIndex,
        };
      }
      const next = [...blocks];
      next.splice(insertIndex, 0, newBlock);
      onChange(normalizeBlockOrder(next));
    } catch (err: any) {
      console.error("Failed to add block:", err);
    }
  };

  const deleteBlock = async (blockId: string) => {
    if (!window.confirm("Delete this content block?")) return;
    try {
      if (onDeleteBlockRemote) {
        await onDeleteBlockRemote(blockId);
      }
      onChange(normalizeBlockOrder(blocks.filter((b) => b.id !== blockId)));
    } catch (err: any) {
      console.error("Failed to delete block:", err);
    }
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[newIndex]] = [
      newBlocks[newIndex],
      newBlocks[index],
    ];
    onChange(normalizeBlockOrder(newBlocks));
  };

  return (
    <div className="space-y-4">
      <AddBlockControl
        label="Add Block at Top"
        blockType={newBlockType}
        onBlockTypeChange={setNewBlockType}
        onAdd={() => addBlock(0)}
        compact
      />

      {blocks.map((block, idx) => (
        <div key={block.id} className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
            {/* Block header */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <GripVertical className="w-4 h-4 text-gray-300" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {block.type}
              </span>
              <span className="text-xs text-gray-400">Block {idx + 1}</span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => moveBlock(idx, "up")}
                disabled={idx === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveBlock(idx, "down")}
                disabled={idx === blocks.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteBlock(block.id)}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Block content */}
            <div className="p-0">
              {block.type === "text" || block.type === "html" ? (
                <TipTapEditor
                  content={block.content}
                  onChange={(html) => updateBlock(block.id, html)}
                  placeholder="Write content here..."
                  uploadImage={uploadImage}
                  registerHtmlGetter={(getter) =>
                    registerHtmlGetter?.(block.id, getter)
                  }
                />
              ) : block.type === "diagram" ? (
                <MermaidEditor
                  content={block.content}
                  onChange={(code) => updateBlock(block.id, code)}
                />
              ) : block.type === "image" ? (
                <ImageBlockEditor
                  value={block.content}
                  onChange={(content) => updateBlock(block.id, content)}
                  uploadImage={uploadImage}
                />
              ) : (
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  rows={block.type === "heading" ? 2 : 6}
                  placeholder={
                    block.type === "heading"
                      ? "Enter heading text..."
                      : "Enter content..."
                  }
                  className="w-full px-4 py-3 outline-none resize-none font-mono text-sm"
                />
              )}
            </div>
          </div>

          <AddBlockControl
            label="Add Block Here"
            blockType={newBlockType}
            onBlockTypeChange={setNewBlockType}
            onAdd={() => addBlock(idx + 1)}
            compact
          />
        </div>
      ))}

      {/* Add new block */}
      <AddBlockControl
        label="Add Block at End"
        blockType={newBlockType}
        onBlockTypeChange={setNewBlockType}
        onAdd={() => addBlock(blocks.length)}
      />
    </div>
  );
}
