import React, { useMemo } from "react";

interface ResponsiveBookDocumentPreviewProps {
  content: string;
  topicId?: string;
  theme?: "light" | "dark";
}

export default function ResponsiveBookDocumentPreview({
  content,
  topicId,
  theme = "light",
}: ResponsiveBookDocumentPreviewProps) {
  const isDark = theme === "dark";

  const scopedStyles = useMemo(() => {
    const textColor = isDark ? "#E5E7EB" : "#1F2937";
    const headingColor = isDark ? "#F9FAFB" : "#111827";
    const borderColor = isDark ? "#374151" : "#E5E7EB";
    const tableHeaderBg = isDark ? "#1E293B" : "#F8FAFC";
    const bg = isDark ? "#0F172A" : "#FFFFFF";

    return `
      .mm-preview-root {
        color: ${textColor};
        background-color: ${bg};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 15px;
        line-height: 1.6;
        padding: 1.5rem;
        border-radius: 0.5rem;
      }
      .mm-preview-root .mm-para {
        margin: 0 0 1em 0;
        white-space: break-spaces;
        word-break: break-word;
      }
      .mm-preview-root .mm-heading {
        color: ${headingColor};
        font-weight: 700;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        line-height: 1.3;
      }
      .mm-preview-root .mm-h1 { font-size: 1.5em; }
      .mm-preview-root .mm-h2 { font-size: 1.3em; }
      .mm-preview-root .mm-h3 { font-size: 1.15em; }
      .mm-preview-root .mm-h4 { font-size: 1.05em; }
      .mm-preview-root .mm-tab {
        display: inline-block;
        min-width: 2em;
        user-select: none;
      }
      .mm-preview-root .mm-table-scroll {
        width: 100%;
        overflow-x: auto;
        margin: 1.25em 0;
        border-radius: 6px;
        border: 1px solid ${borderColor};
      }
      .mm-preview-root .mm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9em;
      }
      .mm-preview-root .mm-table th, .mm-preview-root .mm-table td {
        padding: 8px 12px;
        border: 1px solid ${borderColor};
        vertical-align: top;
      }
      .mm-preview-root .mm-table th {
        background-color: ${tableHeaderBg};
        font-weight: 600;
        color: ${headingColor};
      }
      .mm-preview-root .mm-figure {
        margin: 1.5em 0;
        text-align: center;
        width: 100%;
        overflow-x: auto;
      }
      .mm-preview-root .mm-figure svg {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .mm-preview-root .mm-link {
        color: #4F46E5;
        text-decoration: underline;
      }
      .mm-preview-root .mm-release-marker {
        display: none !important;
      }
    `;
  }, [isDark]);

  return (
    <div className="w-full">
      <style>{scopedStyles}</style>
      <div
        className="mm-preview-root border shadow-sm"
        data-mm-topic={topicId}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
