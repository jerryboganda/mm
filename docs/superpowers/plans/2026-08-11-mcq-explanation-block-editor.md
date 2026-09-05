# MCQ General Explanation Multi-Block Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the multi-block content editor (Rich Text, Heading, Code, Image, HTML, Flowchart / Diagram) into the MCQ General Explanation field in the Admin Dashboard (`McqsPage.tsx`) and support rendering multi-block explanations in the Mobile/Web Client (`AttemptDetailScreen.tsx` & `QuizResultsScreen.tsx`).

**Architecture:** Create a shared, reusable `BlockEditor.tsx` component in the admin dashboard extracted from `TopicEditorPage.tsx`. In `McqsPage.tsx`, parse `explanation` into `ContentBlock[]` for editing, and serialize back to string/JSON on save. In the client, build `McqExplanationRenderer.tsx` to handle parsing and rendering multi-block or single HTML explanations seamlessly.

**Tech Stack:** React, TypeScript, Vite, TipTap (Rich Text), Mermaid.js (Diagrams), React Native / Expo, Tailwind CSS.

## Global Constraints
- Do not alter existing database schemas (`mcqs.explanation` stays `text`).
- Maintain 100% backwards compatibility for existing plain HTML / text MCQ explanations.

---

### Task 1: Create Reusable Admin `BlockEditor` Component

**Files:**
- Create: `admin/src/components/BlockEditor.tsx`
- Modify: `admin/src/pages/TopicEditorPage.tsx:465-563`

**Interfaces:**
- Consumes: `TipTapEditor.tsx`, `MermaidEditor.tsx`, lucide-react icons.
- Produces: `BlockEditor` component exported from `admin/src/components/BlockEditor.tsx`.

- [ ] **Step 1: Create `BlockEditor.tsx`**

```tsx
import { useRef, useState } from "react";
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

const BLOCK_TYPES: { value: BlockType; label: string; icon: any }[] = [
  { value: "text", label: "Rich Text", icon: Type },
  { value: "heading", label: "Heading", icon: Type },
  { value: "code", label: "Code", icon: Code },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "html", label: "HTML", icon: Code },
  { value: "diagram", label: "Flowchart / Diagram", icon: GitBranch },
];

function normalizeBlockOrder(blocks: ContentBlock[]): ContentBlock[] {
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

interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  uploadImage: (file: File) => Promise<string>;
  registerHtmlGetter?: (id: string, getter: (() => string) | null) => void;
  onAddBlockRemote?: (type: BlockType, insertIndex: number) => Promise<ContentBlock>;
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

  const updateBlockContent = (id: string, content: string) => {
    const next = blocks.map((b) => (b.id === id ? { ...b, content } : b));
    onChange(normalizeBlockOrder(next));
  };

  const addBlock = async (insertIndex = blocks.length) => {
    if (onAddBlockRemote) {
      try {
        const newBlock = await onAddBlockRemote(newBlockType, insertIndex);
        const next = [...blocks];
        next.splice(insertIndex, 0, newBlock);
        onChange(normalizeBlockOrder(next));
      } catch (err: any) {
        alert(err.message);
      }
    } else {
      const newBlock: ContentBlock = {
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: newBlockType,
        content: "",
        order: insertIndex,
      };
      const next = [...blocks];
      next.splice(insertIndex, 0, newBlock);
      onChange(normalizeBlockOrder(next));
    }
  };

  const deleteBlock = async (blockId: string) => {
    if (!confirm("Delete this content block?")) return;
    if (onDeleteBlockRemote) {
      try {
        await onDeleteBlockRemote(blockId);
      } catch (err: any) {
        alert(err.message);
        return;
      }
    }
    onChange(normalizeBlockOrder(blocks.filter((b) => b.id !== blockId)));
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
                  onChange={(html) => updateBlockContent(block.id, html)}
                  placeholder="Write content here..."
                  uploadImage={uploadImage}
                  registerHtmlGetter={
                    registerHtmlGetter
                      ? (getter) => registerHtmlGetter(block.id, getter)
                      : undefined
                  }
                />
              ) : block.type === "diagram" ? (
                <MermaidEditor
                  content={block.content}
                  onChange={(code) => updateBlockContent(block.id, code)}
                />
              ) : block.type === "image" ? (
                <ImageBlockEditor
                  value={block.content}
                  onChange={(content) => updateBlockContent(block.id, content)}
                  uploadImage={uploadImage}
                />
              ) : (
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
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

      <AddBlockControl
        label="Add Block at End"
        blockType={newBlockType}
        onBlockTypeChange={setNewBlockType}
        onAdd={() => addBlock(blocks.length)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Refactor `TopicEditorPage.tsx` to use `BlockEditor`**

In `admin/src/pages/TopicEditorPage.tsx`:
Replace the inline rendered blocks list and `AddBlockControl` with `<BlockEditor blocks={localBlocks} onChange={setLocalBlocks} uploadImage={uploadImage} registerHtmlGetter={registerRichTextHtmlGetter} onAddBlockRemote={async (type) => api.post('/admin/content/blocks', { topicId, type, content: '' })} onDeleteBlockRemote={async (id) => api.delete(`/admin/content/blocks/${id}`)} />`.

- [ ] **Step 3: Build & test admin dashboard**
Run: `npm run build` inside `admin` directory or verify TypeScript compilation.

- [ ] **Step 4: Commit**
```bash
git add admin/src/components/BlockEditor.tsx admin/src/pages/TopicEditorPage.tsx
git commit -m "refactor: extract BlockEditor component and refactor TopicEditorPage"
```

---

### Task 2: Integrate `BlockEditor` into MCQ General Explanation in `McqsPage.tsx`

**Files:**
- Modify: `admin/src/pages/McqsPage.tsx:40-180`, `admin/src/pages/McqsPage.tsx:353-365`

**Interfaces:**
- Consumes: `BlockEditor.tsx`, `ContentBlock`.
- Produces: Updated MCQ form supporting multi-block General Explanation.

- [ ] **Step 1: Add Block Conversion Helpers in `McqsPage.tsx`**

```typescript
function parseExplanationToBlocks(explanationStr: string | null | undefined): ContentBlock[] {
  if (!explanationStr || !explanationStr.trim()) {
    return [
      {
        id: `block-${Date.now()}-1`,
        type: 'text',
        content: '',
        order: 0,
      },
    ];
  }
  const trimmed = explanationStr.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((b, idx) => ({
          id: b.id || `block-${Date.now()}-${idx}`,
          type: b.type || 'text',
          content: b.content || '',
          order: idx,
        }));
      }
    } catch (e) {
      // Fall through to plain string fallback
    }
  }
  return [
    {
      id: `block-${Date.now()}-1`,
      type: 'text',
      content: trimmed,
      order: 0,
    },
  ];
}

function serializeBlocksToExplanation(blocks: ContentBlock[]): string {
  const activeBlocks = blocks.filter((b) => b.content && b.content.trim() !== '');
  if (activeBlocks.length === 0) return '';
  if (activeBlocks.length === 1 && (activeBlocks[0].type === 'text' || activeBlocks[0].type === 'html')) {
    return activeBlocks[0].content;
  }
  return JSON.stringify(activeBlocks);
}
```

- [ ] **Step 2: Update `McqsPage.tsx` state and form handlers**

Add `explanationBlocks: ContentBlock[]` to form state.
In `openCreate`:
```typescript
setForm({
  ...
  explanationBlocks: parseExplanationToBlocks(''),
});
```

In `openEdit`:
```typescript
setForm({
  ...
  explanationBlocks: parseExplanationToBlocks(m.explanation),
});
```

In `buildMcqPayload`:
```typescript
const serializedExplanation = serializeBlocksToExplanation(form.explanationBlocks);
return {
  ...
  explanation: serializedExplanation || undefined,
};
```

- [ ] **Step 3: Replace `TipTapEditor` with `BlockEditor` under General Explanation in `McqsPage.tsx`**

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2 font-semibold">
    General Explanation (Rich Text / Tables / Diagrams / Formulas / Images)
  </label>
  <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50 p-3">
    <BlockEditor
      blocks={form.explanationBlocks}
      onChange={(blocks) => setForm((prev) => ({ ...prev, explanationBlocks: blocks }))}
      uploadImage={uploadImage}
    />
  </div>
</div>
```

- [ ] **Step 4: Commit**
```bash
git add admin/src/pages/McqsPage.tsx
git commit -m "feat: add multi-block content editor to MCQ General Explanation"
```

---

### Task 3: Create Mobile/Web Client `McqExplanationRenderer` Component

**Files:**
- Create: `client/components/McqExplanationRenderer.tsx`
- Modify: `client/screens/AttemptDetailScreen.tsx:324`
- Modify: `client/screens/QuizResultsScreen.tsx:240`

**Interfaces:**
- Consumes: `RichTextHtml`, `MermaidDiagram`, `ExplanationImage`, `ThemedText`.
- Produces: `McqExplanationRenderer` component for client app.

- [ ] **Step 1: Create `McqExplanationRenderer.tsx`**

```tsx
import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { RichTextHtml } from "@/components/RichTextHtml";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { resolveAssetUrl } from "@/lib/query-client";

interface ContentBlock {
  id: string;
  type: string;
  content: string;
  order: number;
}

interface McqExplanationRendererProps {
  explanation: string;
  onViewImage?: (url: string) => void;
}

export function McqExplanationRenderer({
  explanation,
  onViewImage,
}: McqExplanationRendererProps) {
  const { theme } = useTheme();

  const blocks = useMemo<ContentBlock[] | null>(() => {
    if (!explanation || !explanation.trim()) return null;
    const trimmed = explanation.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [explanation]);

  if (!explanation) return null;

  // Fallback for single text / legacy HTML
  if (!blocks) {
    return <RichTextHtml content={explanation} />;
  }

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        if (!block.content) return null;
        const key = block.id || `block-${idx}`;

        switch (block.type) {
          case "heading":
            return (
              <ThemedText key={key} type="h3" style={styles.heading}>
                {block.content}
              </ThemedText>
            );
          case "code":
            return (
              <View key={key} style={[styles.codeBox, { backgroundColor: theme.card }]}>
                <ThemedText style={styles.codeText}>{block.content}</ThemedText>
              </View>
            );
          case "image":
            return (
              <Pressable
                key={key}
                style={[styles.imageContainer, { borderColor: theme.glassBorder }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (onViewImage) onViewImage(resolveAssetUrl(block.content));
                }}
              >
                <Image
                  source={{ uri: resolveAssetUrl(block.content) }}
                  style={styles.image}
                  contentFit="cover"
                />
                <View style={styles.imageOverlay}>
                  <Feather name="maximize-2" size={16} color="#fff" />
                </View>
              </Pressable>
            );
          case "diagram":
            return <MermaidDiagram key={key} code={block.content} />;
          case "text":
          case "html":
          default:
            return <RichTextHtml key={key} content={block.content} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  heading: {
    marginTop: 6,
    marginBottom: 4,
  },
  codeBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    height: 200,
    width: "100%",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 16,
    padding: 6,
  },
});
```

- [ ] **Step 2: Update `AttemptDetailScreen.tsx` & `QuizResultsScreen.tsx`**

In `client/screens/AttemptDetailScreen.tsx`:
Replace `<RichTextHtml content={q.explanation} />` with `<McqExplanationRenderer explanation={q.explanation} />`.

In `client/screens/QuizResultsScreen.tsx`:
Replace `<RichTextHtml content={q.explanation} />` with `<McqExplanationRenderer explanation={q.explanation} />`.

- [ ] **Step 3: Commit**
```bash
git add client/components/McqExplanationRenderer.tsx client/screens/AttemptDetailScreen.tsx client/screens/QuizResultsScreen.tsx
git commit -m "feat: add McqExplanationRenderer to render multi-block MCQ explanations"
```
