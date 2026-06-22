import { useState, useRef, useEffect } from 'react';
import { Extension, Node as TiptapNode } from '@tiptap/core';
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
  ArrowUpFromLine, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
  MoveDown, Trash2, Loader2,
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

/* ─── Directional Arrow (sizable, alignment-safe) ────────────────
 * Stored as a self-contained <img> whose src is an inline SVG data URI.
 * Because it is a block-level atom it sits on its own centred line and
 * never disturbs the alignment of surrounding paragraph text. The exact
 * same markup renders natively in every web surface (admin editor, mobile
 * preview, website) and is re-drawn with react-native-svg in the app.
 */
export type ArrowDirection = 'up' | 'down' | 'left' | 'right';

const ARROW_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0f172a'];

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function buildArrowSvg(
  direction: ArrowDirection,
  length: number,
  thickness: number,
  color: string,
) {
  const L = clampNumber(Math.round(length), 24, 600);
  const T = clampNumber(Math.round(thickness), 1, 40);
  const head = Math.max(T * 2.4 + 6, 12);
  const hw = head * 0.62;
  const cross = Math.max(head, T) + 4;
  const vertical = direction === 'up' || direction === 'down';
  const W = Math.round(vertical ? cross : L);
  const H = Math.round(vertical ? L : cross);
  const cx = W / 2;
  const cy = H / 2;
  const r = (n: number) => Math.round(n * 100) / 100;

  let line: string;
  let points: string;
  if (direction === 'down') {
    line = `<line x1="${r(cx)}" y1="${r(T / 2)}" x2="${r(cx)}" y2="${r(H - head)}" />`;
    points = `${r(cx - hw)},${r(H - head)} ${r(cx + hw)},${r(H - head)} ${r(cx)},${r(H)}`;
  } else if (direction === 'up') {
    line = `<line x1="${r(cx)}" y1="${r(head)}" x2="${r(cx)}" y2="${r(H - T / 2)}" />`;
    points = `${r(cx - hw)},${r(head)} ${r(cx + hw)},${r(head)} ${r(cx)},0`;
  } else if (direction === 'right') {
    line = `<line x1="${r(T / 2)}" y1="${r(cy)}" x2="${r(W - head)}" y2="${r(cy)}" />`;
    points = `${r(W - head)},${r(cy - hw)} ${r(W - head)},${r(cy + hw)} ${r(W)},${r(cy)}`;
  } else {
    line = `<line x1="${r(head)}" y1="${r(cy)}" x2="${r(W - T / 2)}" y2="${r(cy)}" />`;
    points = `${r(head)},${r(cy - hw)} ${r(head)},${r(cy + hw)} 0,${r(cy)}`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">` +
    `<g stroke="${color}" stroke-width="${T}" stroke-linecap="round" stroke-linejoin="round">${line}</g>` +
    `<polygon points="${points}" fill="${color}" />` +
    `</svg>`;
  return { svg, width: W, height: H };
}

export function arrowDataUri(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const ArrowNode = TiptapNode.create({
  name: 'mmArrow',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  priority: 1000,

  addAttributes() {
    return {
      direction: { default: 'down' as ArrowDirection },
      length: { default: 120 },
      thickness: { default: 4 },
      color: { default: '#2563eb' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[data-mm-arrow]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            direction: (el.getAttribute('data-mm-arrow') as ArrowDirection) || 'down',
            length: Number(el.getAttribute('data-length')) || 120,
            thickness: Number(el.getAttribute('data-thickness')) || 4,
            color: el.getAttribute('data-color') || '#2563eb',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const direction = (node.attrs.direction as ArrowDirection) || 'down';
    const length = clampNumber(Number(node.attrs.length), 24, 600);
    const thickness = clampNumber(Number(node.attrs.thickness), 1, 40);
    const color = String(node.attrs.color || '#2563eb');
    const { svg, width, height } = buildArrowSvg(direction, length, thickness, color);
    return [
      'img',
      {
        'data-mm-arrow': direction,
        'data-length': String(length),
        'data-thickness': String(thickness),
        'data-color': color,
        class: 'mm-arrow',
        src: arrowDataUri(svg),
        alt: `Arrow pointing ${direction}`,
        width: String(width),
        height: String(height),
        style: `width:${width}px;height:${height}px;display:block;margin:10px auto;`,
      },
    ];
  },
});

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
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  const [customRows, setCustomRows] = useState(3);
  const [customCols, setCustomCols] = useState(2);
  const ref = useRef<HTMLDivElement>(null);

  const GRID_ROWS = 8;
  const GRID_COLS = 8;

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
          {/* Visual grid size picker */}
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-0.5">
              {hover.rows > 0 ? `${hover.rows} × ${hover.cols} table` : 'Pick size'}
            </p>
            <div
              className="inline-grid gap-1"
              style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
              onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
            >
              {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
                const rows = Math.floor(i / GRID_COLS) + 1;
                const cols = (i % GRID_COLS) + 1;
                const active = rows <= hover.rows && cols <= hover.cols;
                return (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={() => setHover({ rows, cols })}
                    onClick={() => { onInsert(rows, cols); setOpen(false); }}
                    className={`h-5 w-5 rounded-sm border transition-colors ${
                      active
                        ? 'bg-primary-400 border-primary-500'
                        : 'bg-gray-100 border-gray-200 hover:border-primary-300'
                    }`}
                    aria-label={`${rows} by ${cols} table`}
                  />
                );
              })}
            </div>
          </div>
          {/* Custom rows × cols */}
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-0.5">Custom Size</p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-500">
                Rows
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={customRows}
                  onChange={(e) => setCustomRows(clampNumber(Number(e.target.value), 1, 30))}
                  className="w-14 px-1.5 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                Cols
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={customCols}
                  onChange={(e) => setCustomCols(clampNumber(Number(e.target.value), 1, 12))}
                  className="w-14 px-1.5 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => { onInsert(customRows, customCols); setOpen(false); }}
                className="ml-auto px-2.5 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700"
              >
                Insert
              </button>
            </div>
          </div>
          {/* Medical Templates */}
          <div className="p-2 max-h-56 overflow-y-auto">
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

function ArrowDropdown({ onInsert }: {
  onInsert: (attrs: { direction: ArrowDirection; length: number; thickness: number; color: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<ArrowDirection>('down');
  const [length, setLength] = useState(120);
  const [thickness, setThickness] = useState(4);
  const [color, setColor] = useState('#2563eb');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const directions: { value: ArrowDirection; icon: React.ReactNode; label: string }[] = [
    { value: 'up', icon: <ArrowUp className="w-4 h-4" />, label: 'Up' },
    { value: 'down', icon: <ArrowDown className="w-4 h-4" />, label: 'Down' },
    { value: 'left', icon: <ArrowLeft className="w-4 h-4" />, label: 'Left' },
    { value: 'right', icon: <ArrowRight className="w-4 h-4" />, label: 'Right' },
  ];

  // Preview is capped so the popover stays compact regardless of chosen length.
  const previewLength = Math.min(length, direction === 'up' || direction === 'down' ? 96 : 200);
  const preview = buildArrowSvg(direction, previewLength, thickness, color);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Insert Arrow"
        className="p-1.5 rounded transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <MoveDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-64 p-3 space-y-3">
          {/* Direction */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Direction</p>
            <div className="grid grid-cols-4 gap-1">
              {directions.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDirection(d.value)}
                  title={d.label}
                  className={`flex items-center justify-center h-8 rounded border transition-colors ${
                    direction === d.value
                      ? 'bg-primary-100 border-primary-400 text-primary-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-primary-300'
                  }`}
                >
                  {d.icon}
                </button>
              ))}
            </div>
          </div>
          {/* Length */}
          <div>
            <label className="flex items-center justify-between text-xs font-medium text-gray-500 mb-1">
              <span>Length</span>
              <span className="text-gray-400">{length}px</span>
            </label>
            <input
              type="range"
              min={24}
              max={400}
              step={4}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>
          {/* Thickness */}
          <div>
            <label className="flex items-center justify-between text-xs font-medium text-gray-500 mb-1">
              <span>Thickness</span>
              <span className="text-gray-400">{thickness}px</span>
            </label>
            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>
          {/* Color */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Color</p>
            <div className="flex items-center gap-1.5">
              {ARROW_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Arrow colour ${c}`}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${
                    color === c ? 'border-gray-800 scale-110' : 'border-white shadow'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {/* Preview */}
          <div className="flex items-center justify-center min-h-[60px] bg-gray-50 rounded-lg border border-gray-100 p-2">
            <span dangerouslySetInnerHTML={{ __html: preview.svg }} />
          </div>
          <button
            type="button"
            onClick={() => { onInsert({ direction, length, thickness, color }); setOpen(false); }}
            className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Insert Arrow
          </button>
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
      ArrowNode,
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

        {/* Arrow */}
        <ArrowDropdown
          onInsert={(attrs) =>
            editor.chain().focus().insertContent({ type: 'mmArrow', attrs }).run()
          }
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
