import test from "node:test";
import assert from "node:assert/strict";
import {
  SOURCE_DOCX_SHA256,
  TOTAL_BOOK_COUNT,
  TOTAL_TOPIC_COUNT,
  isImportedBookBlock,
  parseReleaseMarker,
} from "../shared/book-document-contract";
import {
  validateBookDocumentHtml,
  BookDocumentPolicyViolation,
} from "../server/lib/book-document-policy";

test("shared contract constants match frozen book topology", () => {
  assert.equal(
    SOURCE_DOCX_SHA256,
    "f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605"
  );
  assert.equal(TOTAL_BOOK_COUNT, 13);
  assert.equal(TOTAL_TOPIC_COUNT, 285);
});

test("isImportedBookBlock recognizes document_html blocks", () => {
  assert.equal(isImportedBookBlock({ contentType: "document_html" }), true);
  assert.equal(isImportedBookBlock({ contentType: "text" }), false);
  assert.equal(isImportedBookBlock(null), false);
});

test("parseReleaseMarker extracts releaseSha256 and topicId", () => {
  const html = '<div class="mm-release-marker" data-mm-release="f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605" data-mm-topic="t-mm-01-001"></div>';
  const parsed = parseReleaseMarker(html);
  assert.deepEqual(parsed, {
    releaseSha256: "f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605",
    topicId: "t-mm-01-001",
  });
});

test("validateBookDocumentHtml passes valid and throws on script or overflow", () => {
  const validHtml = '<div class="mm-release-marker" data-mm-release="f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605" data-mm-topic="t-mm-01-001"><p>Safe text</p></div>';
  assert.doesNotThrow(() => validateBookDocumentHtml(validHtml));

  const scriptHtml = '<script>alert("xss")</script>';
  assert.throws(
    () => validateBookDocumentHtml(scriptHtml),
    BookDocumentPolicyViolation
  );
});
