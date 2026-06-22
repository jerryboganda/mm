import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  AlertCircle,
  Bookmark,
  Flag,
  Moon,
  Smartphone,
  Sun,
} from "lucide-react";

interface ContentBlock {
  id: string;
  type: string;
  content: string;
  order: number;
}

interface MobileContentPreviewProps {
  title: string;
  blocks: ContentBlock[];
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
}

const previewCss = `
  .mm-mobile-preview * { box-sizing: border-box; }
  .mm-mobile-preview {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    word-break: break-word;
  }
  .mm-mobile-preview.light {
    color: #111827;
    background: #f7f9fc;
  }
  .mm-mobile-preview.dark {
    color: #f8fafc;
    background: #101828;
  }
  .mm-mobile-preview h1,
  .mm-mobile-preview h2,
  .mm-mobile-preview h3,
  .mm-mobile-preview p,
  .mm-mobile-preview ul,
  .mm-mobile-preview ol,
  .mm-mobile-preview blockquote,
  .mm-mobile-preview pre {
    margin-top: 0;
  }
  .mm-mobile-preview h1 {
    font-size: 24px;
    line-height: 1.22;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .mm-mobile-preview h2 {
    font-size: 20px;
    line-height: 1.28;
    font-weight: 700;
    margin-bottom: 5px;
  }
  .mm-mobile-preview h3,
  .mm-mobile-preview .block-heading {
    font-size: 17px;
    line-height: 1.35;
    font-weight: 700;
    margin: 18px 0 12px;
  }
  .mm-mobile-preview p {
    margin-bottom: 6px;
  }
  .mm-mobile-preview [style*="text-align: left"] {
    text-align: left;
  }
  .mm-mobile-preview [style*="text-align: center"] {
    text-align: center;
  }
  .mm-mobile-preview [style*="text-align: right"] {
    text-align: right;
  }
  .mm-mobile-preview [style*="text-align: justify"] {
    text-align: justify;
  }
  .mm-mobile-preview ul,
  .mm-mobile-preview ol {
    padding-left: 18px;
    margin-bottom: 6px;
  }
  .mm-mobile-preview li {
    margin-bottom: 4px;
    padding-left: 2px;
  }
  .mm-mobile-preview a,
  .mm-mobile-preview .mm-link {
    color: #0099cc;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .mm-mobile-preview strong,
  .mm-mobile-preview b {
    font-weight: 700;
  }
  .mm-mobile-preview em {
    font-style: italic;
  }
  .mm-mobile-preview u {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .mm-mobile-preview s {
    text-decoration: line-through;
  }
  .mm-mobile-preview sup,
  .mm-mobile-preview sub {
    font-size: 10px;
    line-height: 1;
  }
  .mm-mobile-preview blockquote {
    border-left: 3px solid #0099cc;
    padding-left: 12px;
    margin-bottom: 8px;
    color: inherit;
    opacity: 0.82;
    font-style: italic;
  }
  .mm-mobile-preview hr {
    border: 0;
    border-top: 1px solid rgba(15, 23, 42, 0.12);
    margin: 12px 0;
  }
  .mm-mobile-preview.dark hr {
    border-top-color: rgba(255, 255, 255, 0.16);
  }
  .mm-mobile-preview code {
    background: rgba(15, 23, 42, 0.08);
    color: #007aa3;
    border-radius: 4px;
    padding: 1px 4px;
    font-size: 13px;
  }
  .mm-mobile-preview.dark code {
    background: rgba(255, 255, 255, 0.12);
    color: #67d8ff;
  }
  .mm-mobile-preview pre {
    background: rgba(15, 23, 42, 0.08);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    overflow-x: auto;
    white-space: pre-wrap;
  }
  .mm-mobile-preview.dark pre {
    background: rgba(255, 255, 255, 0.12);
  }
  .mm-mobile-preview pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }
  .mm-mobile-preview .table-wrap {
    overflow-x: auto;
    margin: 12px 0;
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 8px;
  }
  .mm-mobile-preview.dark .table-wrap {
    border-color: rgba(255, 255, 255, 0.16);
  }
  .mm-mobile-preview table {
    width: 100%;
    min-width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    margin: 0;
  }
  .mm-mobile-preview th,
  .mm-mobile-preview td {
    border: 1px solid rgba(15, 23, 42, 0.1);
    padding: 8px;
    font-size: 13px;
    line-height: 1.45;
    text-align: left;
    vertical-align: top;
  }
  .mm-mobile-preview.dark th,
  .mm-mobile-preview.dark td {
    border-color: rgba(255, 255, 255, 0.16);
  }
  .mm-mobile-preview th {
    background: rgba(0, 153, 204, 0.12);
    color: #006b8f;
    font-weight: 700;
  }
  .mm-mobile-preview.dark th {
    background: rgba(0, 153, 204, 0.2);
    color: #67d8ff;
  }
  .mm-mobile-preview tbody tr:nth-child(even) td {
    background: rgba(15, 23, 42, 0.025);
  }
  .mm-mobile-preview.dark tbody tr:nth-child(even) td {
    background: rgba(255, 255, 255, 0.04);
  }
  .mm-mobile-preview img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    margin: 8px 0;
  }
  .mm-mobile-preview img.mm-arrow {
    display: block;
    margin: 10px auto;
    border-radius: 0;
  }
  .mm-mobile-preview .note-block {
    display: flex;
    gap: 10px;
    border-left: 3px solid #a855f7;
    background: rgba(168, 85, 247, 0.1);
    border-radius: 12px;
    padding: 14px;
    margin: 12px 0;
  }
  .mm-mobile-preview .diagram-block {
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 12px;
    padding: 12px;
    margin: 12px 0;
    overflow-x: auto;
    background: rgba(255, 255, 255, 0.72);
  }
  .mm-mobile-preview.dark .diagram-block {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.05);
  }
  .mm-mobile-preview .diagram-block svg {
    max-width: 100%;
    height: auto;
  }
`;

function sanitizePreviewHtml(html: string) {
  if (typeof window === "undefined" || !html.trim()) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc.querySelectorAll("script, iframe, object, embed").forEach((node) => {
    node.remove();
  });

  doc.body.querySelectorAll<HTMLElement>("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on")) node.removeAttribute(attribute.name);
      if (
        (name === "href" || name === "src") &&
        value.startsWith("javascript:")
      ) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  doc.querySelectorAll("table").forEach((table) => {
    if (!table.parentElement?.classList.contains("table-wrap")) {
      const wrapper = doc.createElement("div");
      wrapper.className = "table-wrap";
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  });

  return doc.body.innerHTML;
}

function HtmlPreview({ html }: { html: string }) {
  const sanitizedHtml = useMemo(() => sanitizePreviewHtml(html), [html]);
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}

function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const idRef = useRef(`mobile-preview-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!code.trim()) {
        setSvg("");
        setError("");
        return;
      }
      try {
        const result = await mermaid.render(
          `${idRef.current}-${Date.now()}`,
          code.trim(),
        );
        if (!cancelled) {
          setSvg(result.svg);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setSvg("");
          setError(
            err instanceof Error ? err.message : "Invalid diagram syntax",
          );
        }
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="diagram-block">
      {error ? (
        <div className="flex items-center gap-2 text-xs text-red-500">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <span className="text-xs opacity-60">No diagram content</span>
      )}
    </div>
  );
}

function renderBlock(block: ContentBlock) {
  const content = block.content || "";
  if (!content.trim()) return null;

  switch (block.type) {
    case "heading":
      return (
        <h3 key={block.id} className="block-heading">
          {content}
        </h3>
      );
    case "text":
    case "html":
      return <HtmlPreview key={block.id} html={content} />;
    case "image":
      return <img key={block.id} src={content} alt="" />;
    case "note":
      return (
        <div key={block.id} className="note-block">
          <strong>i</strong>
          <span>{content}</span>
        </div>
      );
    case "code":
      return (
        <pre key={block.id}>
          <code>{content}</code>
        </pre>
      );
    case "diagram":
      return <MermaidPreview key={block.id} code={content} />;
    default:
      return <p key={block.id}>{content}</p>;
  }
}

export default function MobileContentPreview({
  title,
  blocks,
  theme,
  onThemeChange,
}: MobileContentPreviewProps) {
  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks],
  );

  return (
    <aside className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <style>{previewCss}</style>
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <Smartphone className="h-4 w-4 text-primary-600" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Mobile Preview
          </p>
          <p className="truncate text-xs text-gray-500">Live unsaved content</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => onThemeChange("light")}
            className={`rounded-md p-1.5 ${
              theme === "light"
                ? "bg-primary-50 text-primary-700"
                : "text-gray-400 hover:text-gray-700"
            }`}
            title="Preview light mode"
          >
            <Sun className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onThemeChange("dark")}
            className={`rounded-md p-1.5 ${
              theme === "dark"
                ? "bg-gray-900 text-white"
                : "text-gray-400 hover:text-gray-700"
            }`}
            title="Preview dark mode"
          >
            <Moon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="bg-slate-100 p-4">
        <div
          className={`mm-mobile-preview ${theme} mx-auto h-[720px] w-full max-w-[390px] overflow-y-auto rounded-[28px] border p-5 shadow-xl ${
            theme === "light" ? "border-slate-200" : "border-slate-700"
          }`}
        >
          <div className="mb-[18px] flex items-start gap-3">
            <h1 className="min-w-0 flex-1 text-[24px] font-bold leading-tight">
              {title || "Topic preview"}
            </h1>
            <Bookmark className="mt-1 h-5 w-5 opacity-50" />
            <Flag className="mt-1 h-5 w-5 opacity-50" />
          </div>
          {sortedBlocks.length > 0 ? (
            sortedBlocks.map(renderBlock)
          ) : (
            <p className="opacity-60">No content blocks yet.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
