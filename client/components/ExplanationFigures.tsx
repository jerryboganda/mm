import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ImageViewer } from "@/components/ImageViewer";
import { getApiUrl } from "@/lib/query-client";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export interface ExplanationImage {
  url: string;
  caption?: string | null;
}

/**
 * Resolves a possibly-relative asset URL (e.g. "/uploads/content-images/..")
 * into an absolute URL the native image loader can fetch. Mirrors the helper
 * used by the TopicReader so uploads behave identically everywhere.
 */
function resolveAssetUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:|data:|file:|blob:)/i.test(url)) return url;
  const base = getApiUrl().replace(/\/+$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

function Figure({
  uri,
  caption,
  onPress,
}: {
  uri: string;
  caption?: string | null;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  // Default to a landscape ratio; corrected on load from the real dimensions.
  const [ratio, setRatio] = useState(1.5);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={caption || "Explanation figure"}
    >
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { aspectRatio: ratio, borderColor: theme.glassBorder },
        ]}
        contentFit="contain"
        transition={150}
        onLoad={(e: any) => {
          const w = e?.source?.width;
          const h = e?.source?.height;
          if (w && h) setRatio(w / h);
        }}
      />
      {caption ? (
        <ThemedText style={[styles.caption, { color: theme.textSecondary }]}>
          {caption}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/**
 * Renders MCQ explanation figures (tables / charts / algorithms) below the
 * explanation text. Tapping a figure opens it in the full-screen zoomable
 * ImageViewer. Renders nothing when there are no images, so it is safe to
 * drop into any results/review screen.
 */
export function ExplanationFigures({
  images,
}: {
  images?: ExplanationImage[] | null;
}) {
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  if (!Array.isArray(images) || images.length === 0) return null;

  return (
    <View style={styles.container}>
      {images.map((img, i) => {
        const uri = resolveAssetUrl(img.url);
        return (
          <Figure
            key={`${uri}-${i}`}
            uri={uri}
            caption={img.caption ?? undefined}
            onPress={() => setViewerUri(uri)}
          />
        );
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
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  image: {
    width: "100%",
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    // White backing so transparent PNG figures stay legible on dark theme.
    backgroundColor: "#ffffff",
  },
  caption: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
});
