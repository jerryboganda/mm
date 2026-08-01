import React, { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions, TextStyle, StyleProp } from "react-native";
import RenderHtml from "react-native-render-html";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";

interface RichTextHtmlProps {
  content: string;
  style?: StyleProp<TextStyle>;
  baseFontSize?: number;
}

export function RichTextHtml({
  content,
  style,
  baseFontSize = 14,
}: RichTextHtmlProps) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.max(width - 48, 280);

  const html = (content || "").trim();

  // If plain text (no HTML tags), render directly with ThemedText
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(html);

  const tagsStyles = useMemo(
    () => ({
      body: {
        color: theme.textSecondary,
        fontSize: baseFontSize,
        lineHeight: Math.round(baseFontSize * 1.5),
        margin: 0,
        padding: 0,
      },
      p: {
        marginTop: 0,
        marginBottom: 8,
        color: theme.textSecondary,
        fontSize: baseFontSize,
        lineHeight: Math.round(baseFontSize * 1.5),
      },
      strong: {
        color: theme.text,
        fontWeight: "700" as const,
      },
      b: {
        color: theme.text,
        fontWeight: "700" as const,
      },
      em: {
        fontStyle: "italic" as const,
      },
      i: {
        fontStyle: "italic" as const,
      },
      u: {
        textDecorationLine: "underline" as const,
      },
      ul: {
        marginTop: 4,
        marginBottom: 8,
        paddingLeft: 16,
      },
      ol: {
        marginTop: 4,
        marginBottom: 8,
        paddingLeft: 16,
      },
      li: {
        marginBottom: 4,
        color: theme.textSecondary,
        fontSize: baseFontSize,
      },
      h1: {
        color: theme.text,
        fontSize: baseFontSize + 4,
        fontWeight: "700" as const,
        marginTop: 8,
        marginBottom: 6,
      },
      h2: {
        color: theme.text,
        fontSize: baseFontSize + 2,
        fontWeight: "700" as const,
        marginTop: 6,
        marginBottom: 4,
      },
      h3: {
        color: theme.text,
        fontSize: baseFontSize + 1,
        fontWeight: "600" as const,
        marginTop: 6,
        marginBottom: 4,
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: theme.primary,
        paddingLeft: 10,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 6,
        marginBottom: 6,
        fontStyle: "italic" as const,
      },
      code: {
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
        borderRadius: 4,
        paddingHorizontal: 4,
        fontSize: baseFontSize - 1,
        color: theme.primary,
      },
      a: {
        color: theme.primary,
        textDecorationLine: "underline" as const,
      },
      img: {
        maxWidth: "100%" as const,
        borderRadius: 6,
        marginVertical: 6,
      },
    }),
    [theme, isDark, baseFontSize],
  );

  if (!html) return null;

  if (!looksLikeHtml) {
    return (
      <ThemedText style={style || { color: theme.textSecondary, fontSize: baseFontSize }}>
        {html}
      </ThemedText>
    );
  }

  return (
    <View style={styles.container}>
      <RenderHtml
        contentWidth={contentWidth}
        source={{ html, baseUrl: getApiUrl() }}
        tagsStyles={tagsStyles}
        enableExperimentalBRCollapsing
        enableExperimentalGhostLinesPrevention
        enableExperimentalMarginCollapsing
        defaultTextProps={{ selectable: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});
