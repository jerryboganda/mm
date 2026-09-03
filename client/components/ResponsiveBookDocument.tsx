import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import { getApiUrl } from "@/lib/query-client";

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
  const [documentHeight, setDocumentHeight] = useState(240);
  const scopedCss = useMemo(() => {
    return `
      :root {
        --mm-text: #111827;
        --mm-heading: #000000;
        --mm-border: #E5E7EB;
        --mm-table-header: #F9FAFB;
        --mm-bg: #FFFFFF;
      }
      body, html {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: var(--mm-text);
        background-color: var(--mm-bg);
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
        line-height: 1.4;
        margin-left: 0 !important;
      }
      .mm-table th, .mm-table td {
        padding: 8px 12px;
        border: 1px solid var(--mm-border) !important;
        vertical-align: top;
        color: var(--mm-text);
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .mm-table th {
        background-color: var(--mm-table-header);
        font-weight: 600;
        color: var(--mm-heading);
      }
      .mm-table p, .mm-table span:not([style*="color:#FF0000"]):not([style*="color: #FF0000"]):not([style*="color:#ff0000"]):not([style*="color: #ff0000"]):not([style*="color:#C00000"]):not([style*="color: #C00000"]) {
        color: var(--mm-text);
      }
      ${`
        .mm-table td[style*="background-color"] *,
        .mm-table th[style*="background-color"] * {
          color: #0F172A !important;
        }
      `}
      .mm-figure {
        margin: 1.5em 0;
        text-align: center;
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border-radius: 8px;
        padding: 8px 0;
      }
      .mm-figure svg {
        max-width: 100%;
        height: auto;
        display: inline-block;
        margin: 0 auto;
      }
      ${`
        .mm-figure text,
        .mm-figure tspan {
          fill: #0F172A !important;
        }
        .mm-figure tspan[fill="#FF0000"],
        .mm-figure tspan[fill="#ff0000"] {
          fill: #DC2626 !important;
        }
      `}
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
  }, []);

  // Web: shrink-to-fit oversized headings (mirrors the native WebView
  // script). Only headings that actually overflow are touched.
  const webRootRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      const root = webRootRef.current;
      if (!root || typeof root.querySelectorAll !== "function") return;
      const heads = root.querySelectorAll(".mm-heading");
      heads.forEach((h: any) => {
        try {
          const sw = h.scrollWidth, cw = h.clientWidth;
          if (sw > cw + 1 && cw > 0) {
            h.style.zoom = Math.max(0.2, cw / sw);
          }
        } catch {}
      });
      try {
        const MAX_INDENT_PX = 192;
        const nodes = root.querySelectorAll("p, div, h1, h2, h3, li");
        nodes.forEach((n: any) => {
          try {
            const cs = window.getComputedStyle(n);
            const ml = parseFloat(cs.marginLeft) || 0;
            const pl = parseFloat(cs.paddingLeft) || 0;
            const ti = parseFloat(cs.textIndent) || 0;
            if (ml > MAX_INDENT_PX) n.style.marginLeft = MAX_INDENT_PX + "px";
            if (pl > MAX_INDENT_PX) n.style.paddingLeft = MAX_INDENT_PX + "px";
            if (ti > MAX_INDENT_PX || ti < -MAX_INDENT_PX)
              n.style.textIndent = (ti > 0 ? MAX_INDENT_PX : -MAX_INDENT_PX) + "px";
          } catch {}
        });
      } catch {}
    } catch {}
  }, [content, topicId]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, style]}>
        <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
        <div
          ref={webRootRef}
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${scopedCss}</style>
      </head>
      <body>
        <div class="mm-book-document" data-mm-topic-root="${topicId || ""}">
          ${content}
        </div>
        <script>
          (function() {
            // Backfill natural dimensions for SVGs compiled before explicit
            // width/height (e.g. stale offline cache): derive px from the
            // EMU viewBox at 96dpi so figures render at true book size.
            try {
              var svgs = document.querySelectorAll('.mm-book-document svg');
              for (var i = 0; i < svgs.length; i++) {
                var s = svgs[i];
                if (s.getAttribute('width') && s.getAttribute('height')) continue;
                var vb = s.getAttribute('viewBox') || s.getAttribute('viewbox') || '';
                var p = vb.trim().split(/[\s,]+/);
                if (p.length === 4) {
                  var w = Math.max(1, Math.round(parseFloat(p[2]) * 96 / 914400));
                  var h = Math.max(1, Math.round(parseFloat(p[3]) * 96 / 914400));
                  if (isFinite(w) && isFinite(h) && w > 0 && h > 0) {
                    s.setAttribute('width', String(w));
                    s.setAttribute('height', String(h));
                  }
                }
              }
            } catch (e) {}
            // Shrink-to-fit oversized headings (e.g. 47pt part-titles whose
            // size lives on an inner run span): zoom the whole heading so a
            // single long word can never force document-level horizontal
            // scroll on narrow viewports. Only headings that actually
            // overflow are touched; all others keep exact book sizes.
            try {
              var heads = document.querySelectorAll('.mm-book-document .mm-heading');
              for (var j = 0; j < heads.length; j++) {
                var h = heads[j];
                var sw = h.scrollWidth, cw = h.clientWidth;
                if (sw > cw + 1 && cw > 0) {
                  var z = Math.max(0.2, cw / sw);
                  h.style.zoom = z;
                }
              }
            } catch (e2) {}
            // Cap pathological indents (e.g. a 360pt left margin) that would
            // push content off-screen on narrow viewports. Normal book
            // indents (<=144pt) are preserved exactly; only outliers are
            // tamed so no paragraph is ever unreachable.
            try {
              var MAX_INDENT_PX = 192;
              var nodes = document.querySelectorAll('.mm-book-document p, .mm-book-document div, .mm-book-document h1, .mm-book-document h2, .mm-book-document h3, .mm-book-document li');
              for (var k = 0; k < nodes.length; k++) {
                var n = nodes[k];
                var ncs = window.getComputedStyle(n);
                var nml = parseFloat(ncs.marginLeft) || 0;
                var npl = parseFloat(ncs.paddingLeft) || 0;
                var nti = parseFloat(ncs.textIndent) || 0;
                if (nml > MAX_INDENT_PX) n.style.marginLeft = MAX_INDENT_PX + 'px';
                if (npl > MAX_INDENT_PX) n.style.paddingLeft = MAX_INDENT_PX + 'px';
                if (nti > MAX_INDENT_PX || nti < -MAX_INDENT_PX) n.style.textIndent = (nti > 0 ? MAX_INDENT_PX : -MAX_INDENT_PX) + 'px';
              }
            } catch (e3) {}
            var scheduled = false;
            function send() {
              if (scheduled) return;
              scheduled = true;
              requestAnimationFrame(function() {
                scheduled = false;
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: "mm-book-height", value: document.documentElement.scrollHeight })
                );
              });
            }
            new ResizeObserver(send).observe(document.documentElement);
            window.addEventListener("load", send);
            setTimeout(send, 60);
            send();
          })();
        </script>
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: webViewHtml, baseUrl: getApiUrl() }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (
              message.type === "mm-book-height" &&
              Number.isFinite(message.value)
            ) {
              setDocumentHeight(Math.max(80, Math.ceil(message.value)));
            }
          } catch {}
        }}
        style={styles.webView}
        containerStyle={{ height: documentHeight }}
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
    flex: 0,
  },
});
