/**
 * Server-side security and schema validation policy for book document HTML.
 */

import { MAX_FRAGMENT_BYTES, SOURCE_DOCX_SHA256, parseReleaseMarker } from "../../shared/book-document-contract";

export class BookDocumentPolicyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookDocumentPolicyViolation";
  }
}

const FORBIDDEN_PATTERNS = [
  /<\s*script[\s/>]/i,
  /<\s*iframe[\s/>]/i,
  /<\s*object[\s/>]/i,
  /<\s*embed[\s/>]/i,
  /<\s*applet[\s/>]/i,
  /<\s*meta[\s/>]/i,
  /<\s*link[\s/>]/i,
  /<\s*base[\s/>]/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /on\w+\s*=/i,
  /expression\s*\(/i,
];

export function validateBookDocumentHtml(
  html: string,
  options: { topicId?: string; requireReleaseMarker?: boolean } = {}
): void {
  if (!html || typeof html !== "string") {
    return;
  }

  const byteLength = Buffer.byteLength(html, "utf8");
  if (byteLength > MAX_FRAGMENT_BYTES) {
    throw new BookDocumentPolicyViolation(
      `Book document block size ${byteLength} bytes exceeds maximum allowed ${MAX_FRAGMENT_BYTES} bytes`
    );
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(html)) {
      throw new BookDocumentPolicyViolation(
        `Disallowed HTML pattern detected in book document content: ${pattern}`
      );
    }
  }

  if (options.requireReleaseMarker) {
    const marker = parseReleaseMarker(html);
    if (!marker) {
      throw new BookDocumentPolicyViolation("Missing mandatory book release marker");
    }
    if (marker.releaseSha256 !== SOURCE_DOCX_SHA256) {
      throw new BookDocumentPolicyViolation(
        `Release digest mismatch: expected ${SOURCE_DOCX_SHA256}, got ${marker.releaseSha256}`
      );
    }
    if (options.topicId && marker.topicId !== options.topicId) {
      throw new BookDocumentPolicyViolation(
        `Topic ID mismatch in marker: expected ${options.topicId}, got ${marker.topicId}`
      );
    }
  }
}
