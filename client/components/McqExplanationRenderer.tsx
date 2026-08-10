import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { RichTextHtml } from "@/components/RichTextHtml";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { ImageViewer } from "@/components/ImageViewer";
import { getApiUrl } from "@/lib/query-client";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export interface ContentBlock {
  id?: string;
  type: string;
  content: string;
  order?: number;
}

export interface McqExplanationRendererProps {
  explanation: string;
  onViewImage?: (url: string) => void;
}

/**
 * Resolves relative asset URLs (e.g. "/uploads/content-images/...") to absolute API URLs.
 */
function resolveAssetUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:|data:|file:|blob:)/i.test(url)) return url;
  const base = getApiUrl().replace(/\/+$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

/**
 * Safely parses the explanation string into an array of ContentBlock objects.
 * Returns null if the explanation is empty or not a valid JSON array of content blocks.
 */
function parseExplanationBlocks(explanation: string): ContentBlock[] | null {
  if (!explanation) return null;
  const trimmed = explanation.trim();
  if (!trimmed.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0] === "object" &&
      parsed[0] !== null &&
      "type" in parsed[0] &&
      "content" in parsed[0]
    ) {
      return parsed as ContentBlock[];
    }
  } catch {
    // Return null on parsing failure to fall back to legacy HTML/text rendering
  }

  return null;
}

export function McqExplanationRenderer({
  explanation,
  onViewImage,
}: McqExplanationRendererProps) {
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.max(windowWidth - Spacing.lg * 2 - 32, 280);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const blocks = parseExplanationBlocks(explanation);

  // Fallback to legacy single HTML / string rendering
  if (!blocks) {
    return <RichTextHtml content={explanation} />;
  }

  const handleImagePress = (url: string) => {
    if (onViewImage) {
      onViewImage(url);
    } else {
      setViewerUri(url);
    }
  };

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        const key = block.id || `block-${index}`;

        switch (block.type) {
          case "heading":
            return (
              <ThemedText key={key} type="h3" style={styles.heading}>
                {block.content}
              </ThemedText>
            );

          case "code":
            return (
              <View
                key={key}
                style={[
                  styles.codeContainer,
                  {
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)",
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <ThemedText style={[styles.codeText, { color: theme.primary }]}>
                  {block.content}
                </ThemedText>
              </View>
            );

          case "image": {
            const resolvedUrl = resolveAssetUrl(block.content);
            return (
              <Pressable
                key={key}
                style={[
                  styles.imageContainer,
                  { borderColor: theme.glassBorder },
                ]}
                onPress={() => handleImagePress(resolvedUrl)}
                accessibilityRole="button"
                accessibilityLabel="View explanation image"
              >
                <Image
                  source={{ uri: resolvedUrl }}
                  style={styles.image}
                  contentFit="contain"
                  transition={150}
                />
                <View style={styles.imageOverlay}>
                  <Feather name="maximize-2" size={14} color="#fff" />
                </View>
              </Pressable>
            );
          }

          case "diagram":
            return (
              <MermaidDiagram
                key={key}
                code={block.content}
                width={contentWidth}
              />
            );

          case "text":
          case "html":
          default:
            return <RichTextHtml key={key} content={block.content} />;
        }
      })}

      <ImageViewer
        visible={!!viewerUri}
        imageUri={viewerUri || ""}
        onClose={() => setViewerUri(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: Spacing.sm,
  },
  heading: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  codeContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginVertical: Spacing.xs,
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    lineHeight: 18,
  },
  imageContainer: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: Spacing.xs,
    backgroundColor: "#ffffff",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    right: Spacing.sm,
    bottom: Spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 6,
    borderRadius: BorderRadius.sm,
  },
});
