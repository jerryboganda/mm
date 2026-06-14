import { useState, useRef, useEffect } from 'react';
import { Extension } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapImage from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Heading1, Heading2, Heading3,
  Minus, Link as LinkIcon, Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon, AlignLeft, AlignCenter, AlignRight,
  Table as TableIcon,
  ArrowRightFromLine, ArrowLeftFromLine, ArrowDownFromLine,
  ArrowUpFromLine, Trash2, Loader2,
} from 'lucide-react';

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadImage?: (file: File) => Promise<string>;
  registerHtmlGetter?: (getter: (() => string) | null) => void;
}

const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList')) {
          return this.editor.commands.sinkListItem('listItem');
        }
        return this.editor.commands.insertContent('\u00a0\u00a0\u00a0\u00a0');
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList')) {
          return this.editor.commands.liftListItem('listItem');
        }
        return false;
      },
    };
  },
});

/* ─── Medical Table Templates ────────────────────────────────── */
const MEDICAL_TABLE_TEMPLATES: { name: string; description: string; html: string }[] = [
  {
    name: 'Comparison Table',
    description: '2-column: Feature vs Description',
    html: `<table><thead><tr><th>Feature</th><th>Description</th></tr></thead><tbody><tr><td></td><td></td></tr><tr><td></td><td></td></tr><tr><td></td><td></td></tr></tbody></table>`,
  },
  {
    name: 'Drug Comparison',
    description: 'Drug, Dose, Route, Indication, Side Effects',
    html: `<table><thead><tr><th>Drug</th><th>Dose</th><th>Route</th><th>Indication</th><th>Side Effects</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>`,
  },
  {
    name: 'Lab Values',
    description: 'Test, Normal Range, Clinical Significance',
    html: `<table><thead><tr><th>Test</th><th>Normal Range</th><th>Clinical Significance</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>`,
  },
  {
    name: 'Generation Comparison',
    description: 'Multi-column procedure comparison',
    html: `<table><thead><tr><th>Procedure</th><th>Mode</th><th>Preparation</th><th>Cavity Length</th><th>Cx Dilation</th><th>Notes</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>`,
  },
  {
    name: 'Differential Diagnosis',
    description: 'Category columns (e.g. PALM-COEIN)',
    html: `<table><thead><tr><th colspan="2"><strong>Organic</strong></th><th colspan="2"><strong>Non-Organic</strong></th></tr></thead><tbody><tr><td><strong>P</strong></td><td>Polyp</td><td><strong>C</strong></td><td>Coagulation</td></tr><tr><td><strong>A</strong></td><td>Adenomyosis</td><td><strong>O</strong></td><td>Ovulation disorders</td></tr><tr><td><strong>L</strong></td><td>Leiomyomas</td><td><strong>I</strong></td><td>Iatrogenic</td></tr><tr><td><strong>M</strong></td><td>Malignancy</td><td><strong>N</strong></td><td>Not identified</td></tr></tbody></table>`,
  },
];

function ToolbarButton({ onClick, active, children, title, disabled }: {
  onClick: () => void; active?: boolean; children: React.ReactNode; title: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors ${
        disabled ? 'text-gray-300 cursor-not-allowed' :
        active ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function TableDropdown({ onInsert, onTemplate }: {
  onInsert: (rows: number, cols: number) => void;
  onTemplate: (html: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Insert Table"
        className="p-1.5 rounded transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <TableIcon className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-64">
          {/* Quick insert 3×3 */}
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 px-1">Quick Insert</p>
            <button
              onClick={() => { onInsert(3, 3); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <TableIcon className="w-3.5 h-3.5 text-gray-400" />
              3 × 3 Table
            </button>
            <button
              onClick={() => { onInsert(4, 4); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <TableIcon className="w-3.5 h-3.5 text-gray-400" />
              4 × 4 Table
            </button>
            <button
              onClick={() => { onInsert(5, 6); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <TableIcon className="w-3.5 h-3.5 text-gray-400" />
              5 × 6 Table
            </button>
          </div>
          {/* Medical Templates */}
          <div className="p-2">
            <p className="text-xs font-medium text-primary-500 uppercase tracking-wider mb-1.5 px-1">Medical Table Templates</p>
            {MEDICAL_TABLE_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => { onTemplate(t.html); setOpen(false); }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-primary-50 flex items-start gap-2"
              >
                <span className="text-primary-400 mt-0.5">⊞</span>
                <span>
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <br />
                  <span className="text-xs text-gray-400">{t.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TipTapEditor({
  content,
  onChange,
  placeholder,
  uploadImage,
  registerHtmlGetter,
}: TipTapEditorProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const lastAppliedContentRef = useRef(content);
  const editor = useEditor({
    extensions: [
      StarterKit,
      TabIndent,
      Underline,
      Placeholder.configure({ placeholder: placeholder || 'Write content here…' }),
      TiptapImage.configure({
        allowBase64: false,
        HTMLAttributes: { class: 'mm-inline-image' },
      }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'mm-table' } }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'mm-link' } }),
      Superscript,
      Subscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
    ],
    content,
    editorProps: {
      /* Preserve pasted HTML faithfully — keep tables, lists, inline styles */
      transformPastedHTML(html: string) {
        // Some word processors use non-standard bullet chars, normalise them
        return html
          .replace(/\u00F0/g, '•')   // ð → •
          .replace(/\u00B7/g, '•')   // · → •
          .replace(/\uf0b7/g, '•')   // private-use bullet → •
          .replace(/\uf0a7/g, '•');  // another private-use → •
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastAppliedContentRef.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor || !registerHtmlGetter) return;

    registerHtmlGetter(() => editor.getHTML());
    return () => registerHtmlGetter(null);
  }, [editor, registerHtmlGetter]);

  useEffect(() => {
    if (!editor || content === lastAppliedContentRef.current) return;

    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
    lastAppliedContentRef.current = content;
  }, [content, editor]);

  if (!editor) return null;

  const uploadAndInsertImage = async (file: File) => {
    if (!uploadImage || !file.type.startsWith('image/')) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const getImageFromFiles = (files?: FileList | null) =>
    Array.from(files || []).find((file) => file.type.startsWith('image/'));

  const handlePaste = (event: React.ClipboardEvent) => {
    const file = getImageFromFiles(event.clipboardData?.files);
    if (!file) return;
    event.preventDefault();
    void uploadAndInsertImage(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    const file = getImageFromFiles(event.dataTransfer?.files);
    if (!file) return;
    event.preventDefault();
    void uploadAndInsertImage(file);
  };

  const addLink = () => {
    const url = window.prompt('URL', editor.getAttributes('link').href || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Inline formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript x²">
          <SuperscriptIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subscript x₂">
          <SubscriptIcon className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Lists & block */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Link */}
        <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Insert Link">
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Table */}
        <TableDropdown
          onInsert={(rows, cols) => editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()}
          onTemplate={(html) => editor.chain().focus().insertContent(html).run()}
        />

        {/* Table context buttons — only visible when cursor inside a table */}
        {editor.isActive('table') && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Before">
              <ArrowLeftFromLine className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column After">
              <ArrowRightFromLine className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Before">
              <ArrowUpFromLine className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row After">
              <ArrowDownFromLine className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
              <Trash2 className="w-4 h-4 text-red-400" />
            </ToolbarButton>
          </>
        )}
        {uploadingImage && (
          <span className="inline-flex items-center gap-1 px-2 text-xs text-primary-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Image
          </span>
        )}
      </div>
      <div
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(event) => {
          if (getImageFromFiles(event.dataTransfer?.files)) event.preventDefault();
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
