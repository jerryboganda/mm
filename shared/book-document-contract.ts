/**
 * Shared contract and types for Maternal Mind authoritative book documents.
 */

export const SOURCE_DOCX_SHA256 =
  "f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605";
export const TOTAL_BOOK_COUNT = 13;
export const TOTAL_TOPIC_COUNT = 285;
export const MAX_FRAGMENT_BYTES = 48 * 1024;

export interface BookDocumentBlock {
  id: string | number;
  topicId: string;
  order: number;
  contentType: string;
  content: string;
  contentSha256?: string;
  sourceSha256?: string;
}

export interface ReleaseMarkerData {
  releaseSha256: string;
  topicId: string;
}

export function isImportedBookBlock(
  block: { contentType?: string | null } | null | undefined,
): boolean {
  return Boolean(block && block.contentType === "document_html");
}

export function parseReleaseMarker(html: string): ReleaseMarkerData | null {
  if (!html) return null;
  const match =
    html.match(
      /class=["']mm-release-marker["'][^>]*data-mm-release=["']([^"']+)["'][^>]*data-mm-topic=["']([^"']+)["']/i,
    ) ||
    html.match(
      /data-mm-release=["']([^"']+)["'][^>]*data-mm-topic=["']([^"']+)["']/i,
    );
  if (!match) return null;
  return {
    releaseSha256: match[1],
    topicId: match[2],
  };
}

export function extractReleaseSha256(html: string): string | null {
  const marker = parseReleaseMarker(html);
  return marker ? marker.releaseSha256 : null;
}
