import React, { useState, useCallback, useRef } from "react";
import { StyleSheet, View, ActivityIndicator, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

interface MermaidDiagramProps {
  code: string;
  width: number;
}

/**
 * Renders a Mermaid diagram inside a WebView.
 * Uses the Mermaid CDN to render the diagram as SVG, then auto-sizes the WebView height.
 */
export function MermaidDiagram({ code, width }: MermaidDiagramProps) {
  const { theme } = useTheme();
  const [height, setHeight] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const isDark = theme.background === "#0A0A0F" || theme.background === "#000";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 50px;
      padding: 8px;
      overflow: hidden;
    }
    #diagram {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    #diagram svg {
      max-width: 100% !important;
      height: auto !important;
    }
    .error {
      color: #EF4444;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      text-align: center;
      padding: 16px;
    }
  </style>
</head>
<body>
  <div id="diagram">
    <pre class="mermaid">${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: '${isDark ? "dark" : "neutral"}',
      securityLevel: 'loose',
      flowchart: { curve: 'basis', htmlLabels: true, padding: 15 },
      themeVariables: ${
        isDark
          ? `{
        primaryColor: '#6C63FF',
        primaryTextColor: '#fff',
        primaryBorderColor: '#5A52D5',
        lineColor: '#6C63FF',
        background: '#1E1E2E',
        mainBkg: '#2A2A3C',
        nodeBorder: '#6C63FF',
        clusterBkg: '#2A2A3C',
        clusterBorder: '#6C63FF',
        titleColor: '#E0E0E0',
        edgeLabelBackground: '#2A2A3C',
      }`
          : `{
        primaryColor: '#6C63FF',
        primaryTextColor: '#fff',
        primaryBorderColor: '#5A52D5',
        lineColor: '#6C63FF',
        secondaryColor: '#F0EEFF',
        tertiaryColor: '#FFF8E1',
      }`
      },
    });

    // After rendering, send the height to React Native
    mermaid.run().then(() => {
      setTimeout(() => {
        const svgEl = document.querySelector('#diagram svg');
        if (svgEl) {
          const h = svgEl.getBoundingClientRect().height + 20;
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: Math.ceil(h) }));
        }
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
      }, 200);
    }).catch((err) => {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', value: err.message }));
    });
  </script>
</body>
</html>`;

  const onMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "height" && data.value > 50) {
        setHeight(data.value);
      }
      if (data.type === "loaded") {
        setLoading(false);
      }
      if (data.type === "error") {
        setError(true);
        setLoading(false);
      }
    } catch {
      // ignore
    }
  }, []);

  if (!code || !code.trim()) return null;

  if (error) {
    return (
      <View style={[styles.container, { borderColor: theme.glassBorder }]}>
        <ThemedText style={styles.errorText}>
          Failed to render diagram
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.glassBorder,
          backgroundColor: isDark ? "#1E1E2E" : "#FAFAFA",
          height: height + 4,
        },
      ]}
    >
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={[styles.webview, { height, opacity: loading ? 0 : 1 }]}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={onMessage}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={Platform.OS === "android"}
        setBuiltInZoomControls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 8,
  },
  webview: {
    backgroundColor: "transparent",
    width: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    padding: 16,
  },
});
