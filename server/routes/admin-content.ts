/**
 * Admin Content Management API Routes
 *
 * Full CRUD for books, chapters, topics, content blocks, and MCQs.
 * All routes protected by authMiddleware + requireRole("admin").
 */
import { Router } from "express";
import multer from "multer";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import { uploadToMinIO } from "../lib/s3";
import {
  adminGetBooks,
  adminGetBook,
  adminCreateBook,
  adminUpdateBook,
  adminDeleteBook,
  adminReorderBooks,
  adminGetChapters,
  adminCreateChapter,
  adminUpdateChapter,
  adminDeleteChapter,
  adminReorderChapters,
  adminGetTopics,
  adminGetTopicsByBook,
  adminGetTopic,
  adminCreateTopic,
  adminUpdateTopic,
  adminDeleteTopic,
  adminReorderTopics,
  adminGetSubtopics,
  adminGetSubtopic,
  adminCreateSubtopic,
  adminUpdateSubtopic,
  adminDeleteSubtopic,
  adminReorderSubtopics,
  adminGetContentBlocks,
  adminGetSubtopicContentBlocks,
  adminCreateContentBlock,
  adminUpdateContentBlock,
  adminDeleteContentBlock,
  adminReorderContentBlocks,
  adminReorderSubtopicContentBlocks,
  adminGetMcqs,
  adminGetMcq,
  adminCreateMcq,
  adminUpdateMcq,
  adminDeleteMcq,
  adminBulkCreateMcqs,
  adminBulkUpdateMcqs,
  adminGetMcqFacets,
  adminGetSubjects,
  adminCreateSubject,
  adminUpdateSubject,
  adminDeleteSubject,
  adminSubjectUsage,
  adminGetSources,
  adminCreateSource,
  adminUpdateSource,
  adminDeleteSource,
  adminSourceMcqCount,
  adminMergeSources,
  adminGetInstitutions,
  adminCreateInstitution,
  adminUpdateInstitution,
  adminDeleteInstitution,
  adminInstitutionMcqCount,
  adminMergeInstitutions,
  adminGetAllTopicsFlat,
  parseBoolFilter,
  parseListFilter,
  type AdminMcqFilters,
  createAuditLog,
} from "../admin-storage";
import { logger } from "../lib/logger";

// ── Validation Schemas ──────────────────────────
const bookSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  isPublished: z.boolean().optional(),
  order: z.number().int().optional(),
});

const chapterSchema = z.object({
  bookId: z.string().min(1, "Book ID is required"),
  subjectId: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  isPublished: z.boolean().optional(),
  order: z.number().int().optional(),
});

const topicBaseSchema = z.object({
  chapterId: z.string().optional().nullable(),
  bookId: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(5000).optional().nullable(),
  isPublished: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  order: z.number().int().optional(),
  author: z.string().max(200).optional().nullable(),
  source: z.string().max(500).optional().nullable(),
  references: z.string().max(5000).optional().nullable(),
});

const topicSchema = topicBaseSchema.refine((data) => data.chapterId || data.bookId, {
  message: "Either chapterId or bookId is required",
});

const subtopicSchema = z.object({
  topicId: z.string().min(1, "Topic ID is required"),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(5000).optional().nullable(),
  isPublished: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  estimatedMinutes: z.number().int().min(1).max(120).optional(),
  order: z.number().int().optional(),
});

const contentBlockBaseSchema = z.object({
  topicId: z.string().optional().nullable(),
  subtopicId: z.string().optional().nullable(),
  type: z.enum(["text", "heading", "image", "note", "html", "code", "diagram"]),
  content: z.string().default(""),
  order: z.number().int().optional(),
});

const contentBlockSchema = contentBlockBaseSchema.refine((data) => data.topicId || data.subtopicId, {
  message: "Either topicId or subtopicId is required",
});

const mcqOptionSchema = z.object({
  label: z.string().min(1),
  text: z.string().min(1),
});

const mcqOptionsSchema = z.union([
  z
    .record(z.string())
    .refine(
      (obj) => Object.keys(obj).length >= 2,
      "At least 2 options required",
    ),
  z.array(mcqOptionSchema).min(2, "At least 2 options required").max(10),
  z.array(z.string().min(1)).min(2, "At least 2 options required").max(10),
]);

function normalizeMcqOptionsToRecord(
  rawOptions: unknown,
): Record<string, string> {
  if (!rawOptions) return {};
  if (Array.isArray(rawOptions)) {
    const map: Record<string, string> = {};
    const fallbackLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
    rawOptions.forEach((item, idx) => {
      const fallback = fallbackLabels[idx] || String.fromCharCode(65 + idx);
      if (typeof item === "string") {
        map[fallback] = item;
      } else if (item && typeof item === "object") {
        const label = String(
          (item as any).label || (item as any).key || fallback,
        )
          .toUpperCase()
          .trim();
        const text = String(
          (item as any).text ??
            (item as any).value ??
            (item as any).option ??
            (item as any).content ??
            "",
        );
        map[label] = text;
      }
    });
    return map;
  }
  if (typeof rawOptions === "object" && rawOptions !== null) {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(
      rawOptions as Record<string, unknown>,
    )) {
      if (v !== null && v !== undefined) {
        map[k.toUpperCase().trim()] = String(v);
      }
    }
    return map;
  }
  return {};
}

function normalizeMcqOptionExplanationsToRecord(
  rawExpls: unknown,
): Record<string, string> | undefined {
  if (!rawExpls) return undefined;
  if (Array.isArray(rawExpls)) {
    const map: Record<string, string> = {};
    const fallbackLabels = ["A", "B", "C", "D", "E"];
    rawExpls.forEach((item, idx) => {
      const fallback = fallbackLabels[idx] || String.fromCharCode(65 + idx);
      if (typeof item === "string") {
        map[fallback] = item;
      } else if (item && typeof item === "object") {
        const label = String(
          (item as any).label || (item as any).key || fallback,
        )
          .toUpperCase()
          .trim();
        const text = String(
          (item as any).text ??
            (item as any).explanation ??
            (item as any).value ??
            "",
        );
        map[label] = text;
      }
    });
    return Object.keys(map).length > 0 ? map : undefined;
  }
  if (typeof rawExpls === "object" && rawExpls !== null) {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawExpls as Record<string, unknown>)) {
      if (v !== null && v !== undefined) {
        map[k.toUpperCase().trim()] = String(v);
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }
  return undefined;
}

/** Normalize free-form tags: trim, collapse case-duplicates, dedupe. */
function normalizeMcqTags(raw: unknown): string[] | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  const list = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const seen = new Map<string, string>();
  for (const item of list) {
    const tag = item.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (!seen.has(key)) seen.set(key, tag);
  }
  return Array.from(seen.values());
}

const mcqSchema = z.object({
  topicId: z.string().min(1, "Topic ID is required"),
  question: z.string().min(1, "Question is required").max(5000),
  options: mcqOptionsSchema,
  correctAnswer: z.string().min(1, "Correct answer is required"),
  explanation: z.string().max(100000).optional().nullable(),
  optionExplanations: z
    .record(z.string().optional().nullable())
    .optional()
    .nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  references: z.string().max(10000).optional().nullable(),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .nullable(),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        caption: z.string().optional().nullable(),
      }),
    )
    .optional()
    .nullable(),
  isPublished: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  year: z.number().int().min(1950).max(2100).optional().nullable(),
  sourceId: z.string().optional().nullable(),
  institutionId: z.string().optional().nullable(),
  questionType: z
    .enum([
      "single_best",
      "multiple_true",
      "negative",
      "assertion_reason",
      "image_based",
      "clinical_vignette",
    ])
    .optional()
    .nullable(),
  examType: z.string().max(100).optional().nullable(),
  isArchived: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** Validate request body against a Zod schema, return parsed data or send 400 */
function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
  res: any,
): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    );
    res.status(400).json({ message: "Validation failed", errors });
    return null;
  }
  return result.data;
}

const router = Router();
const getParamValue = (param: string | string[]) =>
  Array.isArray(param) ? param[0] : param;
const uploadDir = path.resolve(process.cwd(), "uploads", "content-images");
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const imageExtensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

fs.mkdirSync(uploadDir, { recursive: true });

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext =
        imageExtensionByMime[file.mimetype] ||
        path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});
const uploadSingleImage = imageUpload.single("image");

// All routes require admin
router.use(authMiddleware, requireRole("admin"));

router.post(
  "/uploads/images",
  (req, res, next) => {
    uploadSingleImage(req, res, (err: unknown) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "Image must be 10 MB or smaller"
            : err.message;
        return res.status(400).json({ message });
      }

      return res.status(400).json({
        message: err instanceof Error ? err.message : "Image upload failed",
      });
    });
  },
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Image file is required" });
      }

      await uploadToMinIO(
        `uploads/content-images/${req.file.filename}`,
        req.file.path,
        req.file.mimetype,
      );

      await createAuditLog({
        adminUserId: req.userId!,
        action: "create",
        entityType: "content_image",
        entityId: req.file.filename,
        details: {
          filename: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
      });

      res.status(201).json({
        url: `/uploads/content-images/${req.file.filename}`,
        filename: req.file.filename,
      });
    } catch (err: unknown) {
      logger.error("Admin image upload error", { error: String(err) });
      res
        .status(500)
        .json({ message: err instanceof Error ? err.message : String(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════
// BOOKS
// ═══════════════════════════════════════════════════════════════

router.get("/books", async (_req: AuthRequest, res) => {
  try {
    const data = await adminGetBooks();
    res.json(data);
  } catch (err: unknown) {
    logger.error("Admin get books error", { error: String(err) });
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/books", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(bookSchema, req.body, res);
    if (!data) return;
    const book = await adminCreateBook(data);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "book",
      entityId: book.id,
      details: { title: book.title },
    });
    res.status(201).json(book);
  } catch (err: unknown) {
    logger.error("Admin create book error", { error: String(err) });
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/books/:id", async (req: AuthRequest, res) => {
  try {
    const bookId = getParamValue(req.params.id);
    const data = validateBody(bookSchema.partial(), req.body, res);
    if (!data) return;
    const book = await adminUpdateBook(bookId, data);
    if (!book) return res.status(404).json({ message: "Book not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "book",
      entityId: book.id,
      details: req.body,
    });
    res.json(book);
  } catch (err: unknown) {
    logger.error("Admin update book error", { error: String(err) });
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/books/:id", async (req: AuthRequest, res) => {
  try {
    const bookId = getParamValue(req.params.id);
    const book = await adminGetBook(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });
    await adminDeleteBook(bookId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "book",
      entityId: bookId,
      details: { title: book.title },
    });
    res.json({ message: "Book deleted" });
  } catch (err: unknown) {
    logger.error("Admin delete book error", { error: String(err) });
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/books/reorder", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(reorderSchema, req.body, res);
    if (!data) return;
    await adminReorderBooks(data.orderedIds);
    res.json({ message: "Books reordered" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// CHAPTERS
// ═══════════════════════════════════════════════════════════════

router.get("/books/:bookId/chapters", async (req: AuthRequest, res) => {
  try {
    const bookId = getParamValue(req.params.bookId);
    const data = await adminGetChapters(bookId);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/chapters", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(chapterSchema, req.body, res);
    if (!data) return;
    const ch = await adminCreateChapter(data);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "chapter",
      entityId: ch.id,
      details: { title: ch.title },
    });
    res.status(201).json(ch);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/chapters/:id", async (req: AuthRequest, res) => {
  try {
    const chapterId = getParamValue(req.params.id);
    const data = validateBody(chapterSchema.partial(), req.body, res);
    if (!data) return;
    const ch = await adminUpdateChapter(chapterId, data);
    if (!ch) return res.status(404).json({ message: "Chapter not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "chapter",
      entityId: ch.id,
      details: req.body,
    });
    res.json(ch);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/chapters/:id", async (req: AuthRequest, res) => {
  try {
    const chapterId = getParamValue(req.params.id);
    await adminDeleteChapter(chapterId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "chapter",
      entityId: chapterId,
    });
    res.json({ message: "Chapter deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/chapters/reorder", async (req: AuthRequest, res) => {
  try {
    await adminReorderChapters(req.body.bookId, req.body.orderedIds);
    res.json({ message: "Chapters reordered" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// TOPICS
// ═══════════════════════════════════════════════════════════════

router.get("/chapters/:chapterId/topics", async (req: AuthRequest, res) => {
  try {
    const chapterId = getParamValue(req.params.chapterId);
    const data = await adminGetTopics(chapterId);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/books/:bookId/topics", async (req: AuthRequest, res) => {
  try {
    const bookId = getParamValue(req.params.bookId);
    const data = await adminGetTopicsByBook(bookId);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/topics/all", async (_req: AuthRequest, res) => {
  try {
    const data = await adminGetAllTopicsFlat();
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/topics/:id", async (req: AuthRequest, res) => {
  try {
    const topicId = getParamValue(req.params.id);
    const t = await adminGetTopic(topicId);
    if (!t) return res.status(404).json({ message: "Topic not found" });
    res.json(t);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/topics", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(topicSchema, req.body, res);
    if (!data) return;
    const t = await adminCreateTopic(data);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "topic",
      entityId: t.id,
      details: { title: t.title },
    });
    res.status(201).json(t);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/topics/:id", async (req: AuthRequest, res) => {
  try {
    const topicId = getParamValue(req.params.id);
    const data = validateBody(topicBaseSchema.partial(), req.body, res);
    if (!data) return;
    const t = await adminUpdateTopic(topicId, data);
    if (!t) return res.status(404).json({ message: "Topic not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "topic",
      entityId: t.id,
      details: data,
    });
    res.json(t);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/topics/:id", async (req: AuthRequest, res) => {
  try {
    const topicId = getParamValue(req.params.id);
    await adminDeleteTopic(topicId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "topic",
      entityId: topicId,
    });
    res.json({ message: "Topic deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/topics/reorder", async (req: AuthRequest, res) => {
  try {
    const { chapterId, bookId, orderedIds } = req.body;
    if (bookId) {
      await adminReorderTopics(bookId, orderedIds, true);
    } else {
      await adminReorderTopics(chapterId, orderedIds, false);
    }
    res.json({ message: "Topics reordered" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// SUBTOPICS
// ═══════════════════════════════════════════════════════════════

router.get("/topics/:topicId/subtopics", async (req: AuthRequest, res) => {
  try {
    const topicId = getParamValue(req.params.topicId);
    const data = await adminGetSubtopics(topicId);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/subtopics/:id", async (req: AuthRequest, res) => {
  try {
    const subtopicId = getParamValue(req.params.id);
    const s = await adminGetSubtopic(subtopicId);
    if (!s) return res.status(404).json({ message: "Subtopic not found" });
    res.json(s);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/subtopics", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(subtopicSchema, req.body, res);
    if (!data) return;
    const s = await adminCreateSubtopic(data);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "subtopic",
      entityId: s.id,
      details: { title: s.title },
    });
    res.status(201).json(s);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/subtopics/:id", async (req: AuthRequest, res) => {
  try {
    const subtopicId = getParamValue(req.params.id);
    const data = validateBody(subtopicSchema.partial(), req.body, res);
    if (!data) return;
    const s = await adminUpdateSubtopic(subtopicId, data);
    if (!s) return res.status(404).json({ message: "Subtopic not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "subtopic",
      entityId: s.id,
      details: data,
    });
    res.json(s);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/subtopics/:id", async (req: AuthRequest, res) => {
  try {
    const subtopicId = getParamValue(req.params.id);
    await adminDeleteSubtopic(subtopicId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "subtopic",
      entityId: subtopicId,
    });
    res.json({ message: "Subtopic deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/subtopics/reorder", async (req: AuthRequest, res) => {
  try {
    await adminReorderSubtopics(req.body.topicId, req.body.orderedIds);
    res.json({ message: "Subtopics reordered" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONTENT BLOCKS
// ═══════════════════════════════════════════════════════════════

router.get("/topics/:topicId/blocks", async (req: AuthRequest, res) => {
  try {
    const topicId = getParamValue(req.params.topicId);
    const data = await adminGetContentBlocks(topicId);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/subtopics/:subtopicId/blocks", async (req: AuthRequest, res) => {
  try {
    const subtopicId = getParamValue(req.params.subtopicId);
    const data = await adminGetSubtopicContentBlocks(subtopicId);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/blocks", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(contentBlockSchema, req.body, res);
    if (!data) return;
    const cb = await adminCreateContentBlock({
      ...data,
      content: data.content ?? "",
    });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "content_block",
      entityId: cb.id,
    });
    res.status(201).json(cb);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/blocks/:id", async (req: AuthRequest, res) => {
  try {
    const blockId = getParamValue(req.params.id);
    const data = validateBody(contentBlockBaseSchema.partial(), req.body, res);
    if (!data) return;
    const cb = await adminUpdateContentBlock(blockId, data);
    if (!cb)
      return res.status(404).json({ message: "Content block not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "content_block",
      entityId: cb.id,
    });
    res.json(cb);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/blocks/:id", async (req: AuthRequest, res) => {
  try {
    const blockId = getParamValue(req.params.id);
    await adminDeleteContentBlock(blockId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "content_block",
      entityId: blockId,
    });
    res.json({ message: "Content block deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/blocks/reorder", async (req: AuthRequest, res) => {
  try {
    const { topicId, subtopicId, orderedIds } = req.body;
    if (subtopicId) {
      await adminReorderSubtopicContentBlocks(subtopicId, orderedIds);
    } else if (topicId) {
      await adminReorderContentBlocks(topicId, orderedIds);
    }
    res.json({ message: "Blocks reordered" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Batch update multiple blocks + reorder in a single request
router.post("/blocks/batch-save", async (req: AuthRequest, res) => {
  try {
    const { blocks, topicId, subtopicId, orderedIds } = req.body as {
      blocks: { id: string; content: string; type: string }[];
      topicId?: string;
      subtopicId?: string;
      orderedIds: string[];
    };

    if ((!topicId && !subtopicId) || !Array.isArray(orderedIds)) {
      return res
        .status(400)
        .json({ message: "topicId or subtopicId, and orderedIds are required" });
    }

    const existingBlocks = subtopicId
      ? await adminGetSubtopicContentBlocks(subtopicId)
      : await adminGetContentBlocks(topicId!);

    if (existingBlocks.some((b) => b.type === "document_html")) {
      return res.status(403).json({
        message:
          "This topic contains authoritative textbook content from the release pipeline and is locked against direct manual edits to maintain 100% textbook layout parity. Use the content compiler release pipeline to deploy updates.",
      });
    }

    // Update each changed block
    const results = [];
    for (const block of blocks || []) {
      if (!block.id) continue;
      const cb = await adminUpdateContentBlock(block.id, {
        content: block.content,
        type: block.type,
      });
      if (cb) results.push(cb);
    }

    // Reorder
    if (subtopicId) {
      await adminReorderSubtopicContentBlocks(subtopicId, orderedIds);
    } else if (topicId) {
      await adminReorderContentBlocks(topicId, orderedIds);
    }

    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "content_block",
      entityId: subtopicId || topicId!,
      details: `Batch saved ${results.length} blocks`,
    });

    res.json({ message: "Batch save complete", updated: results.length });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// MCQs
// ═══════════════════════════════════════════════════════════════

router.get("/mcqs/facets", async (_req: AuthRequest, res) => {
  try {
    const facets = await adminGetMcqFacets();
    res.json(facets);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/mcqs", async (req: AuthRequest, res) => {
  try {
    const q = req.query as Record<string, unknown>;
    const years = parseListFilter(q.years)
      .map((y) => parseInt(y, 10))
      .filter((y) => Number.isFinite(y));
    const result = await adminGetMcqs({
      topicId: q.topicId as string | undefined,
      topicIds: parseListFilter(q.topicIds),
      bookId: q.bookId as string | undefined,
      subjectId: q.subjectId as string | undefined,
      chapterId: q.chapterId as string | undefined,
      years: years.length ? years : undefined,
      sourceIds: parseListFilter(q.sourceIds),
      institutionId: q.institutionId as string | undefined,
      questionType: q.questionType as string | undefined,
      examType: q.examType as string | undefined,
      difficulty: q.difficulty as string | undefined,
      difficulties: parseListFilter(q.difficulties),
      status: q.status as AdminMcqFilters["status"],
      isPublished: parseBoolFilter(q.isPublished),
      isPaid: parseBoolFilter(q.isPaid),
      tags: parseListFilter(q.tags),
      hasExplanation: parseBoolFilter(q.hasExplanation),
      hasImage: parseBoolFilter(q.hasImage),
      hasYear: parseBoolFilter(q.hasYear),
      hasSource: parseBoolFilter(q.hasSource),
      search: q.search as string | undefined,
      sort: q.sort as string | undefined,
      page: q.page ? parseInt(String(q.page)) : undefined,
      pageSize: q.pageSize ? parseInt(String(q.pageSize)) : undefined,
    });
    res.json(result);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/mcqs/:id", async (req: AuthRequest, res) => {
  try {
    const mcqId = getParamValue(req.params.id);
    const m = await adminGetMcq(mcqId);
    if (!m) return res.status(404).json({ message: "MCQ not found" });
    res.json(m);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/mcqs", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(mcqSchema, req.body, res);
    if (!data) return;
    const m = await adminCreateMcq({
      ...data,
      options: normalizeMcqOptionsToRecord(data.options),
      optionExplanations: normalizeMcqOptionExplanationsToRecord(
        data.optionExplanations,
      ),
      tags: normalizeMcqTags(data.tags),
    });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "mcq",
      entityId: m.id,
    });
    res.status(201).json(m);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/mcqs/:id", async (req: AuthRequest, res) => {
  try {
    const mcqId = getParamValue(req.params.id);
    const data = validateBody(mcqSchema.partial(), req.body, res);
    if (!data) return;
    const payload = {
      ...data,
      ...(data.options
        ? { options: normalizeMcqOptionsToRecord(data.options) }
        : {}),
      ...(data.optionExplanations !== undefined
        ? {
            optionExplanations: normalizeMcqOptionExplanationsToRecord(
              data.optionExplanations,
            ),
          }
        : {}),
      ...(data.tags !== undefined ? { tags: normalizeMcqTags(data.tags) } : {}),
    };
    const m = await adminUpdateMcq(mcqId, payload);
    if (!m) return res.status(404).json({ message: "MCQ not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "mcq",
      entityId: m.id,
    });
    res.json(m);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/mcqs/:id", async (req: AuthRequest, res) => {
  try {
    const mcqId = getParamValue(req.params.id);
    await adminDeleteMcq(mcqId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "mcq",
      entityId: mcqId,
    });
    res.json({ message: "MCQ deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/mcqs/bulk", async (req: AuthRequest, res) => {
  try {
    const bulkSchema = z.object({
      mcqs: z
        .array(mcqSchema)
        .min(1, "Provide at least 1 MCQ")
        .max(500, "Max 500 MCQs per batch"),
    });
    const data = validateBody(bulkSchema, req.body, res);
    if (!data) return;
    const normalizedMcqs = data.mcqs.map((mcq) => ({
      ...mcq,
      options: normalizeMcqOptionsToRecord(mcq.options),
      optionExplanations: normalizeMcqOptionExplanationsToRecord(
        mcq.optionExplanations,
      ),
      tags: normalizeMcqTags(mcq.tags),
    }));
    const created = await adminBulkCreateMcqs(normalizedMcqs);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "bulk_create",
      entityType: "mcq",
      details: { count: created },
    });
    res
      .status(201)
      .json({ message: `${created} MCQs created`, count: created });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/mcqs/bulk-update", async (req: AuthRequest, res) => {
  try {
    const bulkUpdateSchema = z.object({
      ids: z.array(z.string().min(1)).min(1, "Select at least 1 MCQ").max(1000),
      patch: z
        .object({
          year: z.number().int().min(1950).max(2100).nullable().optional(),
          sourceId: z.string().nullable().optional(),
          institutionId: z.string().nullable().optional(),
          questionType: mcqSchema.shape.questionType,
          examType: z.string().max(100).nullable().optional(),
          difficulty: z.enum(["easy", "medium", "hard"]).optional(),
          isPublished: z.boolean().optional(),
          isPaid: z.boolean().optional(),
          isArchived: z.boolean().optional(),
          addTags: z.array(z.string()).optional(),
        })
        .refine(
          (p) => Object.keys(p).length > 0,
          "Provide at least one field to update",
        ),
    });
    const data = validateBody(bulkUpdateSchema, req.body, res);
    if (!data) return;
    const patch = {
      ...data.patch,
      ...(data.patch.addTags
        ? { addTags: normalizeMcqTags(data.patch.addTags) ?? [] }
        : {}),
    };
    const updated = await adminBulkUpdateMcqs(data.ids, patch);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "bulk_update",
      entityType: "mcq",
      details: { count: updated, patch: data.patch },
    });
    res.json({ message: `${updated} MCQs updated`, count: updated });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Subjects (books > subjects > chapters > topics)
// ═══════════════════════════════════════════════════════════════

const subjectSchema = z.object({
  bookId: z.string().min(1, "Book ID is required"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  isPublished: z.boolean().optional(),
  order: z.number().int().optional(),
});

router.get("/subjects", async (req: AuthRequest, res) => {
  try {
    const bookId = req.query.bookId as string | undefined;
    const data = await adminGetSubjects(bookId);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/subjects", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(subjectSchema, req.body, res);
    if (!data) return;
    const s = await adminCreateSubject(data);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "subject",
      entityId: s.id,
    });
    res.status(201).json(s);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/subjects/:id", async (req: AuthRequest, res) => {
  try {
    const id = getParamValue(req.params.id);
    const data = validateBody(
      subjectSchema.partial().extend({
        isActive: z.boolean().optional(),
      }),
      req.body,
      res,
    );
    if (!data) return;
    const s = await adminUpdateSubject(id, data);
    if (!s) return res.status(404).json({ message: "Subject not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "subject",
      entityId: s.id,
    });
    res.json(s);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/subjects/:id", async (req: AuthRequest, res) => {
  try {
    const id = getParamValue(req.params.id);
    const usage = await adminSubjectUsage(id);
    if (usage > 0) {
      return res.status(400).json({
        message: `Subject is assigned to ${usage} topic group(s). Reassign them first or deactivate it.`,
        usage,
      });
    }
    await adminDeleteSubject(id);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "subject",
      entityId: id,
    });
    res.json({ message: "Subject deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Sources (chapter / reference / source entities)
// ═══════════════════════════════════════════════════════════════

const sourceKindEnum = z.enum([
  "textbook",
  "past_paper",
  "university_exam",
  "board_exam",
  "lecture",
  "notes",
  "custom",
]);

const sourceSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  kind: sourceKindEnum.optional(),
  isActive: z.boolean().optional(),
});

router.get("/sources", async (_req: AuthRequest, res) => {
  try {
    res.json(await adminGetSources());
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sources", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(sourceSchema, req.body, res);
    if (!data) return;
    const s = await adminCreateSource(data);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "mcq_source",
      entityId: s.id,
    });
    res.status(201).json(s);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/sources/:id", async (req: AuthRequest, res) => {
  try {
    const id = getParamValue(req.params.id);
    const data = validateBody(sourceSchema.partial(), req.body, res);
    if (!data) return;
    const s = await adminUpdateSource(id, data);
    if (!s) return res.status(404).json({ message: "Source not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "mcq_source",
      entityId: s.id,
    });
    res.json(s);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/sources/:id", async (req: AuthRequest, res) => {
  try {
    const id = getParamValue(req.params.id);
    const usage = await adminSourceMcqCount(id);
    if (usage > 0) {
      return res.status(400).json({
        message: `Source is attached to ${usage} MCQs. Merge it into another source or deactivate it instead.`,
        usage,
      });
    }
    await adminDeleteSource(id);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "mcq_source",
      entityId: id,
    });
    res.json({ message: "Source deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sources/merge", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(
      z.object({
        fromId: z.string().min(1),
        toId: z.string().min(1),
      }),
      req.body,
      res,
    );
    if (!data) return;
    if (data.fromId === data.toId) {
      return res
        .status(400)
        .json({ message: "Cannot merge a source into itself" });
    }
    const moved = await adminMergeSources(data.fromId, data.toId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "merge",
      entityType: "mcq_source",
      entityId: data.toId,
      details: { fromId: data.fromId, movedMcqs: moved },
    });
    res.json({ message: `Merged. ${moved} MCQs reassigned.`, moved });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════
// Institutions
// ═══════════════════════════════════════════════════════════════

const institutionSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  isActive: z.boolean().optional(),
});

router.get("/institutions", async (_req: AuthRequest, res) => {
  try {
    res.json(await adminGetInstitutions());
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/institutions", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(institutionSchema, req.body, res);
    if (!data) return;
    const i = await adminCreateInstitution(data);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "institution",
      entityId: i.id,
    });
    res.status(201).json(i);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/institutions/:id", async (req: AuthRequest, res) => {
  try {
    const id = getParamValue(req.params.id);
    const data = validateBody(institutionSchema.partial(), req.body, res);
    if (!data) return;
    const i = await adminUpdateInstitution(id, data);
    if (!i) return res.status(404).json({ message: "Institution not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "institution",
      entityId: i.id,
    });
    res.json(i);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/institutions/:id", async (req: AuthRequest, res) => {
  try {
    const id = getParamValue(req.params.id);
    const usage = await adminInstitutionMcqCount(id);
    if (usage > 0) {
      return res.status(400).json({
        message: `Institution is attached to ${usage} MCQs. Merge it or deactivate it instead.`,
        usage,
      });
    }
    await adminDeleteInstitution(id);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "institution",
      entityId: id,
    });
    res.json({ message: "Institution deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/institutions/merge", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(
      z.object({ fromId: z.string().min(1), toId: z.string().min(1) }),
      req.body,
      res,
    );
    if (!data) return;
    if (data.fromId === data.toId) {
      return res
        .status(400)
        .json({ message: "Cannot merge an institution into itself" });
    }
    const moved = await adminMergeInstitutions(data.fromId, data.toId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "merge",
      entityType: "institution",
      entityId: data.toId,
      details: { fromId: data.fromId, movedMcqs: moved },
    });
    res.json({ message: `Merged. ${moved} MCQs reassigned.`, moved });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
