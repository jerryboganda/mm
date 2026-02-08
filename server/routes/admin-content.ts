/**
 * Admin Content Management API Routes
 *
 * Full CRUD for books, chapters, topics, content blocks, and MCQs.
 * All routes protected by authMiddleware + requireRole("admin").
 */
import { Router } from "express";
import { z } from "zod";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import {
  adminGetBooks, adminGetBook, adminCreateBook, adminUpdateBook, adminDeleteBook, adminReorderBooks,
  adminGetChapters, adminCreateChapter, adminUpdateChapter, adminDeleteChapter, adminReorderChapters,
  adminGetTopics, adminGetTopic, adminCreateTopic, adminUpdateTopic, adminDeleteTopic, adminReorderTopics,
  adminGetContentBlocks, adminCreateContentBlock, adminUpdateContentBlock, adminDeleteContentBlock, adminReorderContentBlocks,
  adminGetMcqs, adminGetMcq, adminCreateMcq, adminUpdateMcq, adminDeleteMcq, adminBulkCreateMcqs,
  adminGetAllTopicsFlat,
  createAuditLog,
} from "../admin-storage";

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
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  isPublished: z.boolean().optional(),
  order: z.number().int().optional(),
});

const topicSchema = z.object({
  chapterId: z.string().min(1, "Chapter ID is required"),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(5000).optional().nullable(),
  isPublished: z.boolean().optional(),
  order: z.number().int().optional(),
  author: z.string().max(200).optional().nullable(),
  source: z.string().max(500).optional().nullable(),
  references: z.string().max(5000).optional().nullable(),
});

const contentBlockSchema = z.object({
  topicId: z.string().min(1, "Topic ID is required"),
  type: z.enum(["text", "heading", "image", "note"]),
  content: z.string().min(1, "Content is required"),
  order: z.number().int().optional(),
});

const mcqOptionSchema = z.object({
  label: z.string().min(1),
  text: z.string().min(1),
});

const mcqSchema = z.object({
  topicId: z.string().min(1, "Topic ID is required"),
  question: z.string().min(1, "Question is required").max(5000),
  options: z.array(mcqOptionSchema).min(2, "At least 2 options required").max(6),
  correctAnswer: z.string().min(1, "Correct answer is required"),
  explanation: z.string().max(10000).optional().nullable(),
  optionExplanations: z.record(z.string()).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  references: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  isPublished: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** Validate request body against a Zod schema, return parsed data or send 400 */
function validateBody<T>(schema: z.ZodSchema<T>, body: unknown, res: any): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`);
    res.status(400).json({ message: "Validation failed", errors });
    return null;
  }
  return result.data;
}

const router = Router();

// All routes require admin
router.use(authMiddleware, requireRole("admin"));

// ═══════════════════════════════════════════════════════════════
// BOOKS
// ═══════════════════════════════════════════════════════════════

router.get("/books", async (_req: AuthRequest, res) => {
  try {
    const data = await adminGetBooks();
    res.json(data);
  } catch (err: any) {
    console.error("Admin get books error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/books", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(bookSchema, req.body, res);
    if (!data) return;
    const book = await adminCreateBook(data);
    await createAuditLog({ adminUserId: req.userId!, action: "create", entityType: "book", entityId: book.id, details: { title: book.title } });
    res.status(201).json(book);
  } catch (err: any) {
    console.error("Admin create book error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.put("/books/:id", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(bookSchema.partial(), req.body, res);
    if (!data) return;
    const book = await adminUpdateBook(req.params.id, data);
    if (!book) return res.status(404).json({ message: "Book not found" });
    await createAuditLog({ adminUserId: req.userId!, action: "update", entityType: "book", entityId: book.id, details: req.body });
    res.json(book);
  } catch (err: any) {
    console.error("Admin update book error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/books/:id", async (req: AuthRequest, res) => {
  try {
    const book = await adminGetBook(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    await adminDeleteBook(req.params.id);
    await createAuditLog({ adminUserId: req.userId!, action: "delete", entityType: "book", entityId: req.params.id, details: { title: book.title } });
    res.json({ message: "Book deleted" });
  } catch (err: any) {
    console.error("Admin delete book error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/books/reorder", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(reorderSchema, req.body, res);
    if (!data) return;
    await adminReorderBooks(data.orderedIds);
    res.json({ message: "Books reordered" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CHAPTERS
// ═══════════════════════════════════════════════════════════════

router.get("/books/:bookId/chapters", async (req: AuthRequest, res) => {
  try {
    const data = await adminGetChapters(req.params.bookId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/chapters", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(chapterSchema, req.body, res);
    if (!data) return;
    const ch = await adminCreateChapter(data);
    await createAuditLog({ adminUserId: req.userId!, action: "create", entityType: "chapter", entityId: ch.id, details: { title: ch.title } });
    res.status(201).json(ch);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/chapters/:id", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(chapterSchema.partial(), req.body, res);
    if (!data) return;
    const ch = await adminUpdateChapter(req.params.id, data);
    if (!ch) return res.status(404).json({ message: "Chapter not found" });
    await createAuditLog({ adminUserId: req.userId!, action: "update", entityType: "chapter", entityId: ch.id, details: req.body });
    res.json(ch);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/chapters/:id", async (req: AuthRequest, res) => {
  try {
    await adminDeleteChapter(req.params.id);
    await createAuditLog({ adminUserId: req.userId!, action: "delete", entityType: "chapter", entityId: req.params.id });
    res.json({ message: "Chapter deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/chapters/reorder", async (req: AuthRequest, res) => {
  try {
    await adminReorderChapters(req.body.bookId, req.body.orderedIds);
    res.json({ message: "Chapters reordered" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// TOPICS
// ═══════════════════════════════════════════════════════════════

router.get("/chapters/:chapterId/topics", async (req: AuthRequest, res) => {
  try {
    const data = await adminGetTopics(req.params.chapterId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/topics/all", async (_req: AuthRequest, res) => {
  try {
    const data = await adminGetAllTopicsFlat();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/topics/:id", async (req: AuthRequest, res) => {
  try {
    const t = await adminGetTopic(req.params.id);
    if (!t) return res.status(404).json({ message: "Topic not found" });
    res.json(t);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/topics", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(topicSchema, req.body, res);
    if (!data) return;
    const t = await adminCreateTopic(data);
    await createAuditLog({ adminUserId: req.userId!, action: "create", entityType: "topic", entityId: t.id, details: { title: t.title } });
    res.status(201).json(t);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/topics/:id", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(topicSchema.partial(), req.body, res);
    if (!data) return;
    const t = await adminUpdateTopic(req.params.id, data);
    if (!t) return res.status(404).json({ message: "Topic not found" });
    await createAuditLog({ adminUserId: req.userId!, action: "update", entityType: "topic", entityId: t.id, details: data });
    res.json(t);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/topics/:id", async (req: AuthRequest, res) => {
  try {
    await adminDeleteTopic(req.params.id);
    await createAuditLog({ adminUserId: req.userId!, action: "delete", entityType: "topic", entityId: req.params.id });
    res.json({ message: "Topic deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/topics/reorder", async (req: AuthRequest, res) => {
  try {
    await adminReorderTopics(req.body.chapterId, req.body.orderedIds);
    res.json({ message: "Topics reordered" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONTENT BLOCKS
// ═══════════════════════════════════════════════════════════════

router.get("/topics/:topicId/blocks", async (req: AuthRequest, res) => {
  try {
    const data = await adminGetContentBlocks(req.params.topicId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/blocks", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(contentBlockSchema, req.body, res);
    if (!data) return;
    const cb = await adminCreateContentBlock(data);
    await createAuditLog({ adminUserId: req.userId!, action: "create", entityType: "content_block", entityId: cb.id });
    res.status(201).json(cb);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/blocks/:id", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(contentBlockSchema.partial(), req.body, res);
    if (!data) return;
    const cb = await adminUpdateContentBlock(req.params.id, data);
    if (!cb) return res.status(404).json({ message: "Content block not found" });
    await createAuditLog({ adminUserId: req.userId!, action: "update", entityType: "content_block", entityId: cb.id });
    res.json(cb);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/blocks/:id", async (req: AuthRequest, res) => {
  try {
    await adminDeleteContentBlock(req.params.id);
    await createAuditLog({ adminUserId: req.userId!, action: "delete", entityType: "content_block", entityId: req.params.id });
    res.json({ message: "Content block deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/blocks/reorder", async (req: AuthRequest, res) => {
  try {
    await adminReorderContentBlocks(req.body.topicId, req.body.orderedIds);
    res.json({ message: "Blocks reordered" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// MCQs
// ═══════════════════════════════════════════════════════════════

router.get("/mcqs", async (req: AuthRequest, res) => {
  try {
    const { topicId, difficulty, isPublished, search, page, pageSize } = req.query as any;
    const result = await adminGetMcqs({
      topicId,
      difficulty,
      isPublished: isPublished === "true" ? true : isPublished === "false" ? false : undefined,
      search,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/mcqs/:id", async (req: AuthRequest, res) => {
  try {
    const m = await adminGetMcq(req.params.id);
    if (!m) return res.status(404).json({ message: "MCQ not found" });
    res.json(m);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/mcqs", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(mcqSchema, req.body, res);
    if (!data) return;
    const m = await adminCreateMcq(data);
    await createAuditLog({ adminUserId: req.userId!, action: "create", entityType: "mcq", entityId: m.id });
    res.status(201).json(m);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/mcqs/:id", async (req: AuthRequest, res) => {
  try {
    const data = validateBody(mcqSchema.partial(), req.body, res);
    if (!data) return;
    const m = await adminUpdateMcq(req.params.id, data);
    if (!m) return res.status(404).json({ message: "MCQ not found" });
    await createAuditLog({ adminUserId: req.userId!, action: "update", entityType: "mcq", entityId: m.id });
    res.json(m);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/mcqs/:id", async (req: AuthRequest, res) => {
  try {
    await adminDeleteMcq(req.params.id);
    await createAuditLog({ adminUserId: req.userId!, action: "delete", entityType: "mcq", entityId: req.params.id });
    res.json({ message: "MCQ deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/mcqs/bulk", async (req: AuthRequest, res) => {
  try {
    const bulkSchema = z.object({ mcqs: z.array(mcqSchema).min(1, "Provide at least 1 MCQ").max(500, "Max 500 MCQs per batch") });
    const data = validateBody(bulkSchema, req.body, res);
    if (!data) return;
    const created = await adminBulkCreateMcqs(data.mcqs);
    await createAuditLog({ adminUserId: req.userId!, action: "bulk_create", entityType: "mcq", details: { count: created } });
    res.status(201).json({ message: `${created} MCQs created`, count: created });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
