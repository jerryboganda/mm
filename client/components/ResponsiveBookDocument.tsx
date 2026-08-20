import React, { useMemo } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import WebView from "react-native-webview";
import { useTheme } from "@/hooks/useTheme";

interface ResponsiveBookDocumentProps {
  content: string;
  topicId?: string;
  style?: any;
}

export function ResponsiveBookDocument({
  content,
  topicId,
  style,
}: ResponsiveBookDocumentProps) {
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const scopedCss = useMemo(() => {
    const textColor = theme.text || (isDark ? "#F3F4F6" : "#111827");
    const headingColor = theme.text || (isDark ? "#FFFFFF" : "#000000");
    const linkColor = theme.primary || "#4F46E5";
    const borderColor = theme.glassBorder || (isDark ? "#374151" : "#E5E7EB");
    const tableHeaderBg = isDark ? "#1F2937" : "#F9FAFB";
    const bg = theme.backgroundDefault || (isDark ? "#111827" : "#FFFFFF");

    return `
      :root {
        --mm-text: ${textColor};
        --mm-heading: ${headingColor};
        --mm-link: ${linkColor};
        --mm-border: ${borderColor};
        --mm-table-header: ${tableHeaderBg};
        --mm-bg: ${bg};
      }
      body, html {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: var(--mm-text);
        background-color: transparent;
        font-size: 16px;
        line-height: 1.6;
        -webkit-text-size-adjust: 100%;
      }
      .mm-para {
        margin: 0 0 1em 0;
        white-space: break-spaces;
        word-break: break-word;
      }
      .mm-heading {
        color: var(--mm-heading);
        font-weight: 700;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        line-height: 1.3;
      }
      .mm-h1 { font-size: 1.5em; }
      .mm-h2 { font-size: 1.3em; }
      .mm-h3 { font-size: 1.15em; }
      .mm-h4 { font-size: 1.05em; }
      .mm-tab {
        display: inline-block;
        min-width: 2em;
        user-select: none;
      }
      .mm-table-scroll {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        margin: 1.25em 0;
        border-radius: 8px;
        border: 1px solid var(--mm-border);
      }
      .mm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9em;
        line-height: 1.4;
        margin-left: 0 !important;
      }
      .mm-table th, .mm-table td {
        padding: 8px 12px;
        border: 1px solid var(--mm-border) !important;
        vertical-align: top;
        color: var(--mm-text);
      }
      .mm-table th {
        background-color: var(--mm-table-header);
        font-weight: 600;
        color: var(--mm-heading);
      }
      .mm-table p, .mm-table span:not([style*="color:#FF0000"]):not([style*="color: #FF0000"]):not([style*="color:#ff0000"]):not([style*="color: #ff0000"]):not([style*="color:#C00000"]):not([style*="color: #C00000"]) {
        color: var(--mm-text);
      }
      ${
        isDark
          ? `
        .mm-table td, .mm-table th {
          border-color: #374151 !important;
        }
        .mm-table td[style*="background-color"],
        .mm-table th[style*="background-color"] {
          background-color: #1E293B !important;
          color: #F8FAFC !important;
        }
        .mm-table td[style*="background-color"] *,
        .mm-table th[style*="background-color"] * {
          color: #F8FAFC !important;
        }
        span[style*="color:#FF0000"],
        span[style*="color: #FF0000"],
        span[style*="color:#ff0000"],
        span[style*="color: #ff0000"],
        span[style*="color:#C00000"],
        span[style*="color: #C00000"] {
          color: #F87171 !important;
        }
        span[style*="color:#000000"],
        span[style*="color: #000000"],
        span[style*="color:#000"],
        span[style*="color: #000"],
        span[style*="color:black"],
        span[style*="color: black"],
        p[style*="color:#000000"],
        p[style*="color: #000000"],
        p[style*="color:black"] {
          color: var(--mm-text) !important;
        }
      `
          : `
        .mm-table td[style*="background-color"] *,
        .mm-table th[style*="background-color"] * {
          color: #0F172A !important;
        }
      `
      }
      .mm-figure {
        margin: 1.5em 0;
        text-align: center;
        width: 100%;
        overflow-x: auto;
      }
      .mm-figure svg {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .mm-link {
        color: var(--mm-link);
        text-decoration: underline;
      }
      .mm-list {
        margin: 0.5em 0 1em 1.5em;
        padding: 0;
      }
      .mm-list li {
        margin-bottom: 0.35em;
      }
      .mm-header-banner {
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
      .mm-header-banner * {
        color: #FFFFFF !important;
      }
      .mm-list-item {
        display: flex;
        align-items: baseline;
        margin-bottom: 0.4em;
        line-height: 1.5;
      }
      .mm-list-marker {
        display: inline-block;
        min-width: 1.5em;
        margin-right: 0.5em;
        font-weight: 600;
        flex-shrink: 0;
        color: var(--mm-text);
      }
      .mm-list-body {
        flex: 1;
      }
      .mm-release-marker {
        display: none !important;
      }
    `;
  }, [theme, isDark]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, style]}>
        <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
        <div
          className="mm-book-document"
          data-mm-topic-root={topicId}
          dangerouslySetInnerHTML={{ __html: content }}
          style={{ width: "100%" }}
        />
      </View>
    );
  }

  // Native WebView wrapper for 100% SVG and Table CSS support on iOS & Android
  const webViewHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>${scopedCss}</style>
      </head>
      <body>
        <div class="mm-book-document" data-mm-topic-root="${topicId || ""}">
          ${content}
        </div>
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: webViewHtml }}
        style={styles.webView}
        scrollEnabled={false}
        nestedScrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  webView: {
    backgroundColor: "transparent",
    width: "100%",
  },
});
