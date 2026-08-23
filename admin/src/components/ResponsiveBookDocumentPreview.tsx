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
      .mm-preview-root .mm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9em;
        margin-left: 0 !important;
      }
      .mm-preview-root .mm-table th, .mm-preview-root .mm-table td {
        padding: 8px 12px;
        border: 1px solid ${borderColor} !important;
        vertical-align: top;
        color: ${textColor};
      }
      .mm-preview-root .mm-table th {
        background-color: ${tableHeaderBg};
        font-weight: 600;
        color: ${headingColor};
      }
      .mm-preview-root .mm-table p, .mm-preview-root .mm-table span:not([style*="color:#FF0000"]):not([style*="color: #FF0000"]):not([style*="color:#ff0000"]):not([style*="color:#ff0000"]):not([style*="color:#C00000"]):not([style*="color: #C00000"]) {
        color: ${textColor};
      }
      ${
        isDark
          ? `
        .mm-preview-root .mm-table td, .mm-preview-root .mm-table th {
          border-color: #374151 !important;
        }
        .mm-preview-root .mm-table td[style*="background-color"],
        .mm-preview-root .mm-table th[style*="background-color"] {
          background-color: #1E293B !important;
          color: #F8FAFC !important;
        }
        .mm-preview-root .mm-table td[style*="background-color"] *,
        .mm-preview-root .mm-table th[style*="background-color"] * {
          color: #F8FAFC !important;
        }
        .mm-preview-root span[style*="color:#FF0000"],
        .mm-preview-root span[style*="color: #FF0000"],
        .mm-preview-root span[style*="color:#ff0000"],
        .mm-preview-root span[style*="color: #ff0000"],
        .mm-preview-root span[style*="color:#C00000"],
        .mm-preview-root span[style*="color: #C00000"] {
          color: #F87171 !important;
        }
        .mm-preview-root span[style*="color:#000000"],
        .mm-preview-root span[style*="color: #000000"],
        .mm-preview-root span[style*="color:#000"],
        .mm-preview-root span[style*="color: #000"],
        .mm-preview-root span[style*="color:black"],
        .mm-preview-root span[style*="color: black"],
        .mm-preview-root p[style*="color:#000000"],
        .mm-preview-root p[style*="color: #000000"],
        .mm-preview-root p[style*="color:black"] {
          color: ${textColor} !important;
        }
      `
          : `
        .mm-preview-root .mm-table td[style*="background-color"] *,
        .mm-preview-root .mm-table th[style*="background-color"] * {
          color: #0F172A !important;
        }
      `
      }
      .mm-preview-root .mm-figure {
        margin: 1.5em 0;
        text-align: center;
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border-radius: 8px;
        padding: 8px 0;
      }
      .mm-preview-root .mm-figure svg {
        max-width: 100%;
        min-width: 650px;
        height: auto;
        display: inline-block;
        margin: 0 auto;
      }
      ${
        isDark
          ? `
        .mm-preview-root .mm-figure path[fill="#FFFFFF"],
        .mm-preview-root .mm-figure path[fill="#ffffff"],
        .mm-preview-root .mm-figure rect[fill="#FFFFFF"],
        .mm-preview-root .mm-figure rect[fill="#ffffff"] {
          fill: #1E293B !important;
          stroke: #475569 !important;
        }
        .mm-preview-root .mm-figure path[fill="#DAE3F3"],
        .mm-preview-root .mm-figure path[fill="#dae3f3"] {
          fill: #1E3A8A !important;
          stroke: #60A5FA !important;
        }
        .mm-preview-root .mm-figure rect[fill="#9CC2E5"],
        .mm-preview-root .mm-figure rect[fill="#9cc2e5"] {
          fill: #334155 !important;
        }
        .mm-preview-root .mm-figure line[stroke="#000000"],
        .mm-preview-root .mm-figure line[stroke="#000"],
        .mm-preview-root .mm-figure path[stroke="#000000"],
        .mm-preview-root .mm-figure path[stroke="#000"] {
          stroke: #94A3B8 !important;
        }
        .mm-preview-root .mm-figure text,
        .mm-preview-root .mm-figure tspan {
          fill: ${textColor} !important;
        }
        .mm-preview-root .mm-figure tspan[fill="#FF0000"],
        .mm-preview-root .mm-figure tspan[fill="#ff0000"] {
          fill: #F87171 !important;
        }
      `
          : `
        .mm-preview-root .mm-figure text,
        .mm-preview-root .mm-figure tspan {
          fill: #0F172A !important;
        }
        .mm-preview-root .mm-figure tspan[fill="#FF0000"],
        .mm-preview-root .mm-figure tspan[fill="#ff0000"] {
          fill: #DC2626 !important;
        }
      `
      }
      .mm-preview-root .mm-link {
        color: #4F46E5;
        text-decoration: underline;
      }
      .mm-preview-root .mm-header-banner {
        display: block;
        background-color: #2F5496;
        color: #FFFFFF !important;
        padding: 8px 14px;
        border-radius: 6px;
        font-weight: 700;
        margin-top: 1.2em;
        margin-bottom: 0.8em;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      .mm-preview-root .mm-header-banner * {
        color: #FFFFFF !important;
      }
      .mm-preview-root .mm-list-item {
        display: flex;
        align-items: baseline;
        margin-bottom: 0.4em;
        line-height: 1.5;
      }
      .mm-preview-root .mm-list-marker {
        display: inline-block;
        min-width: 1.5em;
        margin-right: 0.5em;
        font-weight: 600;
        flex-shrink: 0;
        color: ${textColor};
      }
      .mm-preview-root .mm-list-body {
        flex: 1;
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
