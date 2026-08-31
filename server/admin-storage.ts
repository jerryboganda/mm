/**
 * Admin-specific storage methods for content CRUD, user management,
 * analytics, announcements, and audit logging.
 */
import {
  users,
  books,
  subjects,
  chapters,
  topics,
  contentBlocks,
  mcqs,
  sources,
  institutions,
  mcqStats,
  userProgress,
  quizAttempts,
  announcements,
  auditLogs,
  contentReports,
  recentActivity,
  type Book,
  type Subject,
  type Chapter,
  type Topic,
  type ContentBlock,
  type MCQ,
  type McqSource,
  type Institution,
  type User,
  type Announcement,
  type AuditLog,
} from "../shared/schema";
import { db } from "./db";
import {
  eq,
  and,
  asc,
  desc,
  sql,
  count,
  ilike,
  or,
  inArray,
  isNotNull,
} from "drizzle-orm";
import { countActiveSessionsByUserIds } from "./lib/device-sessions";

// ── Books CRUD ────────────────────────────────────────────────

export async function adminGetBooks(): Promise<Book[]> {
  return db.select().from(books).orderBy(asc(books.order));
}

export async function adminGetBook(id: string): Promise<Book | undefined> {
  const [book] = await db.select().from(books).where(eq(books.id, id));
  return book || undefined;
}

export async function adminCreateBook(data: {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  isPublished?: boolean;
  order?: number;
}): Promise<Book> {
  // Auto-order: get max order and add 1
  if (data.order === undefined) {
    const [maxRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${books.order}), -1)` })
      .from(books);
    data.order = (maxRow?.maxOrder ?? -1) + 1;
  }
  const [book] = await db.insert(books).values(data).returning();
  return book;
}

export async function adminUpdateBook(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    imageUrl: string | null;
    isPublished: boolean;
    order: number;
  }>,
): Promise<Book | undefined> {
  const [book] = await db
    .update(books)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(books.id, id))
    .returning();
  return book || undefined;
}

export async function adminDeleteBook(id: string): Promise<void> {
  await db.delete(books).where(eq(books.id, id));
}

export async function adminReorderBooks(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(books)
      .set({ order: i, updatedAt: new Date() })
      .where(eq(books.id, orderedIds[i]));
  }
}

// ── Chapters CRUD ─────────────────────────────────────────────

export async function adminGetChapters(bookId: string): Promise<Chapter[]> {
  return db
    .select()
    .from(chapters)
    .where(eq(chapters.bookId, bookId))
    .orderBy(asc(chapters.order));
}

export async function adminGetChapter(
  id: string,
): Promise<Chapter | undefined> {
  const [ch] = await db.select().from(chapters).where(eq(chapters.id, id));
  return ch || undefined;
}

export async function adminCreateChapter(data: {
  bookId: string;
  subjectId?: string | null;
  title: string;
  description?: string | null;
  isPublished?: boolean;
  order?: number;
}): Promise<Chapter> {
  if (data.order === undefined) {
    const [maxRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${chapters.order}), -1)` })
      .from(chapters)
      .where(eq(chapters.bookId, data.bookId));
    data.order = (maxRow?.maxOrder ?? -1) + 1;
  }
  const [ch] = await db.insert(chapters).values(data).returning();
  return ch;
}

export async function adminUpdateChapter(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    isPublished: boolean;
    order: number;
    bookId: string;
    subjectId: string | null;
  }>,
): Promise<Chapter | undefined> {
  const [ch] = await db
    .update(chapters)
    .set(data)
    .where(eq(chapters.id, id))
    .returning();
  return ch || undefined;
}

export async function adminDeleteChapter(id: string): Promise<void> {
  await db.delete(chapters).where(eq(chapters.id, id));
}

export async function adminReorderChapters(
  bookId: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(chapters)
      .set({ order: i })
      .where(and(eq(chapters.id, orderedIds[i]), eq(chapters.bookId, bookId)));
  }
}

// ── Topics CRUD ───────────────────────────────────────────────

export async function adminGetTopics(chapterId: string): Promise<Topic[]> {
  return db
    .select()
    .from(topics)
    .where(eq(topics.chapterId, chapterId))
    .orderBy(asc(topics.order));
}

export async function adminGetTopic(id: string): Promise<Topic | undefined> {
  const [t] = await db.select().from(topics).where(eq(topics.id, id));
  return t || undefined;
}

export async function adminCreateTopic(data: {
  chapterId: string;
  title: string;
  description?: string | null;
  isPublished?: boolean;
  isPaid?: boolean;
  order?: number;
  author?: string | null;
  source?: string | null;
  references?: string | null;
}): Promise<Topic> {
  if (data.order === undefined) {
    const [maxRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${topics.order}), -1)` })
      .from(topics)
      .where(eq(topics.chapterId, data.chapterId));
    data.order = (maxRow?.maxOrder ?? -1) + 1;
  }
  const [t] = await db.insert(topics).values(data).returning();
  return t;
}

export async function adminUpdateTopic(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    isPublished: boolean;
    isPaid: boolean;
    order: number;
    chapterId: string;
    author: string | null;
    source: string | null;
    references: string | null;
  }>,
): Promise<Topic | undefined> {
  const [t] = await db
    .update(topics)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(topics.id, id))
    .returning();
  return t || undefined;
}

export async function adminDeleteTopic(id: string): Promise<void> {
  await db.delete(topics).where(eq(topics.id, id));
}

export async function adminReorderTopics(
  chapterId: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(topics)
      .set({ order: i })
      .where(
        and(eq(topics.id, orderedIds[i]), eq(topics.chapterId, chapterId)),
      );
  }
}

// ── Content Blocks CRUD ───────────────────────────────────────

export async function adminGetContentBlocks(
  topicId: string,
): Promise<ContentBlock[]> {
  return db
    .select()
    .from(contentBlocks)
    .where(eq(contentBlocks.topicId, topicId))
    .orderBy(asc(contentBlocks.order));
}

export async function adminCreateContentBlock(data: {
  topicId: string;
  type: string;
  content: string;
  order?: number;
}): Promise<ContentBlock> {
  if (data.order === undefined) {
    const [maxRow] = await db
      .select({
        maxOrder: sql<number>`coalesce(max(${contentBlocks.order}), -1)`,
      })
      .from(contentBlocks)
      .where(eq(contentBlocks.topicId, data.topicId));
    data.order = (maxRow?.maxOrder ?? -1) + 1;
  }
  const [cb] = await db.insert(contentBlocks).values(data).returning();
  return cb;
}

export async function adminUpdateContentBlock(
  id: string,
  data: Partial<{ type: string; content: string; order: number }>,
): Promise<ContentBlock | undefined> {
  const [cb] = await db
    .update(contentBlocks)
    .set(data)
    .where(eq(contentBlocks.id, id))
    .returning();
  return cb || undefined;
}

export async function adminDeleteContentBlock(id: string): Promise<void> {
  await db.delete(contentBlocks).where(eq(contentBlocks.id, id));
}

export async function adminReorderContentBlocks(
  topicId: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(contentBlocks)
      .set({ order: i })
      .where(
        and(
          eq(contentBlocks.id, orderedIds[i]),
          eq(contentBlocks.topicId, topicId),
        ),
      );
  }
}

// ── MCQs CRUD ─────────────────────────────────────────────────

export interface AdminMcqFilters {
  topicId?: string;
  topicIds?: string[];
  bookId?: string;
  subjectId?: string;
  chapterId?: string;
  years?: number[];
  sourceIds?: string[];
  institutionId?: string;
  questionType?: string;
  examType?: string;
  difficulty?: string;
  difficulties?: string[];
  status?: "published" | "draft" | "archived";
  isPublished?: boolean;
  isPaid?: boolean;
  tags?: string[];
  hasExplanation?: boolean;
  hasImage?: boolean;
  hasYear?: boolean;
  hasSource?: boolean;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export type AdminMcqRow = MCQ & {
  sourceName: string | null;
  subjectName: string | null;
  chapterTitle: string | null;
  topicTitle: string | null;
  attempts: number;
  correct: number;
};

function parseBoolFilter(raw: unknown): boolean | undefined {
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  return undefined;
}

export function parseListFilter(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim())
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

export { parseBoolFilter };

export async function adminGetMcqs(
  filters?: AdminMcqFilters,
): Promise<{ data: AdminMcqRow[]; total: number }> {
  const page = filters?.page ?? 1;
  const pageSize = Math.min(filters?.pageSize ?? 50, 200);
  const offset = (page - 1) * pageSize;

  const conditions: any[] = [];
  if (filters?.topicId) conditions.push(eq(mcqs.topicId, filters.topicId));
  if (filters?.topicIds?.length)
    conditions.push(inArray(mcqs.topicId, filters.topicIds));
  if (filters?.chapterId)
    conditions.push(eq(topics.chapterId, filters.chapterId));
  if (filters?.subjectId)
    conditions.push(eq(chapters.subjectId, filters.subjectId));
  if (filters?.bookId) conditions.push(eq(chapters.bookId, filters.bookId));
  if (filters?.years?.length)
    conditions.push(inArray(mcqs.year, filters.years));
  if (filters?.sourceIds?.length)
    conditions.push(inArray(mcqs.sourceId, filters.sourceIds));
  if (filters?.institutionId)
    conditions.push(eq(mcqs.institutionId, filters.institutionId));
  if (filters?.questionType)
    conditions.push(eq(mcqs.questionType, filters.questionType));
  if (filters?.examType) conditions.push(eq(mcqs.examType, filters.examType));
  if (filters?.difficulty)
    conditions.push(eq(mcqs.difficulty, filters.difficulty));
  if (filters?.difficulties?.length)
    conditions.push(inArray(mcqs.difficulty, filters.difficulties));
  if (filters?.isPublished !== undefined)
    conditions.push(eq(mcqs.isPublished, filters.isPublished));
  if (filters?.isPaid !== undefined)
    conditions.push(eq(mcqs.isPaid, filters.isPaid));

  switch (filters?.status) {
    case "archived":
      conditions.push(eq(mcqs.isArchived, true));
      break;
    case "published":
      conditions.push(eq(mcqs.isArchived, false), eq(mcqs.isPublished, true));
      break;
    case "draft":
      conditions.push(eq(mcqs.isArchived, false), eq(mcqs.isPublished, false));
      break;
  }

  if (filters?.tags?.length) {
    const tagConds = filters.tags.map(
      (t) => sql`${mcqs.tags} @> ${JSON.stringify([t])}::jsonb`,
    );
    conditions.push(or(...tagConds));
  }
  if (filters?.hasExplanation !== undefined) {
    const has = sql`coalesce(length(${mcqs.explanation}), 0) > 0`;
    conditions.push(filters.hasExplanation ? has : sql`not ${has}`);
  }
  if (filters?.hasImage !== undefined) {
    const has = sql`coalesce(jsonb_array_length(${mcqs.images}), 0) > 0`;
    conditions.push(filters.hasImage ? has : sql`not ${has}`);
  }
  if (filters?.hasYear !== undefined) {
    conditions.push(
      filters.hasYear ? isNotNull(mcqs.year) : sql`${mcqs.year} IS NULL`,
    );
  }
  if (filters?.hasSource !== undefined) {
    conditions.push(
      filters.hasSource
        ? isNotNull(mcqs.sourceId)
        : sql`${mcqs.sourceId} IS NULL`,
    );
  }
  if (filters?.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(mcqs.question, term),
        ilike(mcqs.references, term),
        sql`coalesce(${mcqs.tags}::text, '') ilike ${term}`,
        sql`coalesce(${mcqs.id}, '') ilike ${term}`,
        ilike(sources.name, term),
        ilike(topics.title, term),
        ilike(chapters.title, term),
        ilike(subjects.title, term),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const joins = (query: any) =>
    query
      .leftJoin(sources, eq(mcqs.sourceId, sources.id))
      .leftJoin(topics, eq(mcqs.topicId, topics.id))
      .leftJoin(chapters, eq(topics.chapterId, chapters.id))
      .leftJoin(subjects, eq(chapters.subjectId, subjects.id))
      .leftJoin(mcqStats, eq(mcqStats.mcqId, mcqs.id));

  const [totalRow] = await joins(
    db.select({ total: count(mcqs.id) }).from(mcqs),
  ).where(where);

  const sort = filters?.sort || "seq_asc";
  const orderBy: any[] = [];
  switch (sort) {
    case "seq_desc":
      orderBy.push(desc(mcqs.seq));
      break;
    case "year_asc":
      orderBy.push(sql`${mcqs.year} IS NULL`, asc(mcqs.year), asc(mcqs.seq));
      break;
    case "year_desc":
      orderBy.push(sql`${mcqs.year} IS NULL`, desc(mcqs.year), asc(mcqs.seq));
      break;
    case "difficulty":
      orderBy.push(
        sql`case ${mcqs.difficulty} when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 else 4 end`,
        asc(mcqs.seq),
      );
      break;
    case "chapter_asc":
      orderBy.push(
        sql`${chapters.title} IS NULL`,
        asc(chapters.title),
        asc(mcqs.seq),
      );
      break;
    case "most_attempted":
      orderBy.push(desc(mcqStats.attempts), asc(mcqs.seq));
      break;
    case "lowest_accuracy":
      orderBy.push(
        sql`case when coalesce(${mcqStats.attempts}, 0) = 0 then null else ${mcqStats.correct}::float / ${mcqStats.attempts} end IS NULL`,
        sql`case when coalesce(${mcqStats.attempts}, 0) = 0 then null else ${mcqStats.correct}::float / ${mcqStats.attempts} end asc nulls last`,
        asc(mcqs.seq),
      );
      break;
    case "seq_asc":
    default:
      orderBy.push(asc(mcqs.seq));
      break;
  }

  const rows = await joins(
    db
      .select({
        mcq: mcqs,
        sourceName: sources.name,
        subjectName: subjects.title,
        chapterTitle: chapters.title,
        topicTitle: topics.title,
        attempts: sql<number>`coalesce(${mcqStats.attempts}, 0)`.as("attempts"),
        correct: sql<number>`coalesce(${mcqStats.correct}, 0)`.as("correct"),
      })
      .from(mcqs),
  )
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset(offset);

  const data = rows.map((r: any) => ({
    ...r.mcq,
    sourceName: r.sourceName ?? null,
    subjectName: r.subjectName ?? null,
    chapterTitle: r.chapterTitle ?? null,
    topicTitle: r.topicTitle ?? null,
    attempts: Number(r.attempts ?? 0),
    correct: Number(r.correct ?? 0),
  })) as AdminMcqRow[];

  return { data, total: Number(totalRow?.total ?? 0) };
}

export async function adminGetMcqFacets(): Promise<{
  years: number[];
  tags: { tag: string; count: number }[];
  examTypes: string[];
  questionTypes: string[];
}> {
  const yearRows = await db
    .select({ year: mcqs.year })
    .from(mcqs)
    .where(isNotNull(mcqs.year))
    .groupBy(mcqs.year)
    .orderBy(desc(mcqs.year));
  const tagResult = await db.execute(
    sql`SELECT t.value AS tag, count(*)::int AS count
        FROM "mcqs" m, jsonb_array_elements_text(m."tags") AS t(value)
        WHERE m."tags" IS NOT NULL
        GROUP BY t.value
        ORDER BY count(*) DESC, t.value ASC`,
  );
  const tagRows = (
    Array.isArray(tagResult) ? tagResult : (tagResult as { rows?: unknown[] }).rows ?? []
  ) as { tag: string; count: number }[];
  const examTypeRows = await db
    .select({ examType: mcqs.examType })
    .from(mcqs)
    .where(isNotNull(mcqs.examType))
    .groupBy(mcqs.examType);
  const qtRows = await db
    .select({ questionType: mcqs.questionType })
    .from(mcqs)
    .where(isNotNull(mcqs.questionType))
    .groupBy(mcqs.questionType);

  return {
    years: yearRows.map((r: { year: number | null }) => r.year as number),
    tags: tagRows.map((r: any) => ({
      tag: String(r.tag),
      count: Number(r.count),
    })),
    examTypes: examTypeRows.map(
      (r: { examType: string | null }) => r.examType as string,
    ),
    questionTypes: qtRows.map(
      (r: { questionType: string | null }) => r.questionType as string,
    ),
  };
}

export async function adminGetMcq(id: string): Promise<MCQ | undefined> {
  const [m] = await db.select().from(mcqs).where(eq(mcqs.id, id));
  return m || undefined;
}

export async function adminCreateMcq(data: {
  topicId: string;
  question: string;
  options: unknown;
  correctAnswer: string;
  explanation?: string | null;
  optionExplanations?: unknown | null;
  difficulty?: string;
  references?: string | null;
  tags?: unknown | null;
  images?: unknown | null;
  isPublished?: boolean;
  isPaid?: boolean;
  year?: number | null;
  sourceId?: string | null;
  institutionId?: string | null;
  questionType?: string | null;
  examType?: string | null;
  isArchived?: boolean;
}): Promise<MCQ> {
  const payload = {
    ...data,
    isPublished: data.isPublished !== false,
  };
  const [m] = await db.insert(mcqs).values(payload).returning();
  return m;
}

export async function adminUpdateMcq(
  id: string,
  data: Partial<{
    question: string;
    options: unknown;
    correctAnswer: string;
    explanation: string | null;
    optionExplanations: unknown | null;
    difficulty: string;
    references: string | null;
    tags: unknown | null;
    images: unknown | null;
    isPublished: boolean;
    isPaid: boolean;
    topicId: string;
    year: number | null;
    sourceId: string | null;
    institutionId: string | null;
    questionType: string | null;
    examType: string | null;
    isArchived: boolean;
  }>,
): Promise<MCQ | undefined> {
  // NOTE: `seq` is intentionally absent — editing must never change order.
  const [m] = await db
    .update(mcqs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(mcqs.id, id))
    .returning();
  return m || undefined;
}

export async function adminBulkUpdateMcqs(
  ids: string[],
  patch: Partial<{
    year: number | null;
    sourceId: string | null;
    institutionId: string | null;
    questionType: string | null;
    examType: string | null;
    difficulty: string;
    isPublished: boolean;
    isPaid: boolean;
    isArchived: boolean;
    addTags: string[];
  }>,
): Promise<number> {
  if (ids.length === 0) return 0;
  const { addTags, ...setFields } = patch;
  const updates: Record<string, unknown> = {
    ...setFields,
    updatedAt: new Date(),
  };
  // Drop fields that were not requested
  for (const k of Object.keys(updates)) {
    if (updates[k] === undefined) delete updates[k];
  }
  const fieldCount = Object.keys(updates).filter((k) => k !== "updatedAt").length;
  if (fieldCount === 0 && !addTags?.length) return 0;

  let updated = ids.length;
  if (fieldCount > 0) {
    const result = await db
      .update(mcqs)
      .set(updates)
      .where(inArray(mcqs.id, ids))
      .returning({ id: mcqs.id });
    updated = result.length;
  }
  if (addTags?.length) {
    await db
      .update(mcqs)
      .set({
        tags: sql`coalesce(${mcqs.tags}, '[]'::jsonb) || ${JSON.stringify(addTags)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(inArray(mcqs.id, ids));
    // Deduplicate tags per row (jsonb arrays keep duplicates on ||)
    await db.execute(
      sql`UPDATE "mcqs" SET "tags" = (
            SELECT coalesce(jsonb_agg(DISTINCT t.value), '[]'::jsonb)
            FROM jsonb_array_elements_text("tags") AS t(value)
          )
          WHERE "id" IN ${ids} AND "tags" IS NOT NULL`,
    );
  }
  return updated;
}

export async function adminDeleteMcq(id: string): Promise<void> {
  await db.delete(mcqs).where(eq(mcqs.id, id));
}

export async function adminBulkCreateMcqs(
  mcqList: {
    topicId: string;
    question: string;
    options: unknown;
    correctAnswer: string;
    explanation?: string | null;
    optionExplanations?: unknown | null;
    difficulty?: string;
    references?: string | null;
    tags?: unknown | null;
    images?: unknown | null;
    isPublished?: boolean;
    isPaid?: boolean;
    year?: number | null;
    sourceId?: string | null;
    institutionId?: string | null;
    questionType?: string | null;
    examType?: string | null;
    isArchived?: boolean;
  }[],
): Promise<number> {
  if (mcqList.length === 0) return 0;
  const listToInsert = mcqList.map((m) => ({
    ...m,
    isPublished: m.isPublished !== false,
  }));
  const result = await db.insert(mcqs).values(listToInsert).returning();
  return result.length;
}

// ── Metadata entities: subjects / sources / institutions ─────

export async function adminGetSubjects(bookId?: string): Promise<Subject[]> {
  const where = bookId ? eq(subjects.bookId, bookId) : undefined;
  return db.select().from(subjects).where(where).orderBy(asc(subjects.order));
}

export async function adminCreateSubject(data: {
  bookId: string;
  title: string;
  description?: string | null;
  isPublished?: boolean;
  order?: number;
}): Promise<Subject> {
  if (data.order === undefined) {
    const [maxRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${subjects.order}), -1)` })
      .from(subjects)
      .where(eq(subjects.bookId, data.bookId));
    data.order = (maxRow?.maxOrder ?? -1) + 1;
  }
  const [s] = await db.insert(subjects).values(data).returning();
  return s;
}

export async function adminUpdateSubject(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    isPublished: boolean;
    isActive: boolean;
    order: number;
    bookId: string;
  }>,
): Promise<Subject | undefined> {
  const [s] = await db
    .update(subjects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subjects.id, id))
    .returning();
  return s || undefined;
}

export async function adminSubjectUsage(id: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(chapters)
    .where(eq(chapters.subjectId, id));
  return Number(row?.total ?? 0);
}

export async function adminDeleteSubject(id: string): Promise<void> {
  await db.delete(subjects).where(eq(subjects.id, id));
}

export async function adminGetSources(): Promise<
  (McqSource & { mcqCount: number })[]
> {
  const rows = await db
    .select({
      source: sources,
      mcqCount: count(mcqs.id),
    })
    .from(sources)
    .leftJoin(mcqs, eq(mcqs.sourceId, sources.id))
    .groupBy(sources.id)
    .orderBy(asc(sources.order), asc(sources.name));
  return rows.map((r: any) => ({ ...r.source, mcqCount: Number(r.mcqCount) }));
}

export async function adminCreateSource(data: {
  name: string;
  kind?: string;
  isActive?: boolean;
}): Promise<McqSource> {
  const name = data.name.trim();
  // Case-insensitive dedupe: reuse an existing source with the same name.
  const [existing] = await db
    .select()
    .from(sources)
    .where(sql`lower(${sources.name}) = lower(${name})`)
    .limit(1);
  if (existing) return existing;
  const [maxRow] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${sources.order}), -1)` })
    .from(sources);
  const [s] = await db
    .insert(sources)
    .values({ ...data, name, order: (maxRow?.maxOrder ?? -1) + 1 })
    .returning();
  return s;
}

export async function adminUpdateSource(
  id: string,
  data: Partial<{
    name: string;
    kind: string;
    isActive: boolean;
    order: number;
  }>,
): Promise<McqSource | undefined> {
  const [s] = await db
    .update(sources)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sources.id, id))
    .returning();
  return s || undefined;
}

export async function adminSourceMcqCount(id: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(mcqs)
    .where(eq(mcqs.sourceId, id));
  return Number(row?.total ?? 0);
}

export async function adminDeleteSource(id: string): Promise<void> {
  await db.delete(sources).where(eq(sources.id, id));
}

/** Merge duplicate sources: reassign all MCQs, then remove the duplicate. */
export async function adminMergeSources(
  fromId: string,
  toId: string,
): Promise<number> {
  const result = await db
    .update(mcqs)
    .set({ sourceId: toId, updatedAt: new Date() })
    .where(eq(mcqs.sourceId, fromId))
    .returning({ id: mcqs.id });
  await db.delete(sources).where(eq(sources.id, fromId));
  return result.length;
}

export async function adminGetInstitutions(): Promise<
  (Institution & { mcqCount: number })[]
> {
  const rows = await db
    .select({
      institution: institutions,
      mcqCount: count(mcqs.id),
    })
    .from(institutions)
    .leftJoin(mcqs, eq(mcqs.institutionId, institutions.id))
    .groupBy(institutions.id)
    .orderBy(asc(institutions.name));
  return rows.map((r: any) => ({
    ...r.institution,
    mcqCount: Number(r.mcqCount),
  }));
}

export async function adminCreateInstitution(data: {
  name: string;
}): Promise<Institution> {
  const name = data.name.trim();
  const [existing] = await db
    .select()
    .from(institutions)
    .where(sql`lower(${institutions.name}) = lower(${name})`)
    .limit(1);
  if (existing) return existing;
  const [i] = await db.insert(institutions).values({ name }).returning();
  return i;
}

export async function adminUpdateInstitution(
  id: string,
  data: Partial<{ name: string; isActive: boolean }>,
): Promise<Institution | undefined> {
  const [i] = await db
    .update(institutions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(institutions.id, id))
    .returning();
  return i || undefined;
}

export async function adminInstitutionMcqCount(id: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(mcqs)
    .where(eq(mcqs.institutionId, id));
  return Number(row?.total ?? 0);
}

export async function adminDeleteInstitution(id: string): Promise<void> {
  await db.delete(institutions).where(eq(institutions.id, id));
}

export async function adminMergeInstitutions(
  fromId: string,
  toId: string,
): Promise<number> {
  const result = await db
    .update(mcqs)
    .set({ institutionId: toId, updatedAt: new Date() })
    .where(eq(mcqs.institutionId, fromId))
    .returning({ id: mcqs.id });
  await db.delete(institutions).where(eq(institutions.id, fromId));
  return result.length;
}

// ── Users Management ──────────────────────────────────────────

export async function adminGetUsers(filters?: {
  search?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  data: (Omit<User, "password"> & { activeDeviceCount: number })[];
  total: number;
}> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions: any[] = [];
  if (filters?.role) conditions.push(eq(users.role, filters.role));
  if (filters?.search) {
    conditions.push(
      or(
        ilike(users.name, `%${filters.search}%`),
        ilike(users.email, `%${filters.search}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(users)
    .where(where);
  const data = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: users.role,
      password: sql<string>`'***'`.as("password"),
      phoneNumber: users.phoneNumber,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionExpiresAt: users.subscriptionExpiresAt,
      isActive: users.isActive,
      deactivatedAt: users.deactivatedAt,
      deactivationReason: users.deactivationReason,
      deletionRequestedAt: users.deletionRequestedAt,
      deletionStatus: users.deletionStatus,
      createdAt: users.createdAt,
      isEmailVerified: users.isEmailVerified,
      emailVerificationToken: users.emailVerificationToken,
      emailTokenExpiresAt: users.emailTokenExpiresAt,
      isPhoneVerified: users.isPhoneVerified,
      phoneVerificationToken: users.phoneVerificationToken,
      phoneTokenExpiresAt: users.phoneTokenExpiresAt,
      deviceLimitOverrideEnabled: users.deviceLimitOverrideEnabled,
      deviceLimitMax: users.deviceLimitMax,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset);

  const activeDeviceCounts = await countActiveSessionsByUserIds(
    data.map((user: any) => user.id),
  );

  return {
    data: data.map((user: any) => ({
      ...user,
      activeDeviceCount: activeDeviceCounts.get(user.id) || 0,
    })),
    total: Number(totalRow?.total ?? 0),
  };
}

export async function adminGetUserDetail(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return undefined;

  const [progressCount] = await db
    .select({ count: count() })
    .from(userProgress)
    .where(
      and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)),
    );

  const [attemptCount] = await db
    .select({ count: count() })
    .from(quizAttempts)
    .where(eq(quizAttempts.userId, userId));

  return {
    ...user,
    password: undefined,
    completedTopics: Number(progressCount?.count ?? 0),
    quizAttempts: Number(attemptCount?.count ?? 0),
  };
}

export async function adminUpdateUser(
  userId: string,
  data: Partial<{
    role: string;
    subscriptionStatus: string;
    subscriptionPlan: string | null;
    subscriptionExpiresAt: Date | null;
    name: string;
    isEmailVerified: boolean;
    deviceLimitOverrideEnabled: boolean;
    deviceLimitMax: number | null;
  }>,
): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, userId))
    .returning();
  return user || undefined;
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

// ── Analytics ─────────────────────────────────────────────────

export async function adminGetDashboardStats() {
  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [totalBooks] = await db.select({ count: count() }).from(books);
  const [totalChapters] = await db.select({ count: count() }).from(chapters);
  const [totalTopics] = await db.select({ count: count() }).from(topics);
  const [totalMcqs] = await db.select({ count: count() }).from(mcqs);
  const [totalAttempts] = await db
    .select({ count: count() })
    .from(quizAttempts);
  const [publishedBooks] = await db
    .select({ count: count() })
    .from(books)
    .where(eq(books.isPublished, true));
  const [publishedTopics] = await db
    .select({ count: count() })
    .from(topics)
    .where(eq(topics.isPublished, true));
  const [publishedMcqs] = await db
    .select({ count: count() })
    .from(mcqs)
    .where(eq(mcqs.isPublished, true));
  const [pendingReports] = await db
    .select({ count: count() })
    .from(contentReports)
    .where(eq(contentReports.status, "pending"));

  // Users in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [newUsersWeek] = await db
    .select({ count: count() })
    .from(users)
    .where(sql`${users.createdAt} >= ${sevenDaysAgo}`);

  // Active users (had recent activity in last 7 days)
  const [activeUsers] = await db
    .select({ count: sql<number>`count(distinct ${recentActivity.userId})` })
    .from(recentActivity)
    .where(sql`${recentActivity.viewedAt} >= ${sevenDaysAgo}`);

  return {
    totalUsers: Number(totalUsers?.count ?? 0),
    totalBooks: Number(totalBooks?.count ?? 0),
    totalChapters: Number(totalChapters?.count ?? 0),
    totalTopics: Number(totalTopics?.count ?? 0),
    totalMcqs: Number(totalMcqs?.count ?? 0),
    totalAttempts: Number(totalAttempts?.count ?? 0),
    publishedBooks: Number(publishedBooks?.count ?? 0),
    publishedTopics: Number(publishedTopics?.count ?? 0),
    publishedMcqs: Number(publishedMcqs?.count ?? 0),
    pendingReports: Number(pendingReports?.count ?? 0),
    newUsersThisWeek: Number(newUsersWeek?.count ?? 0),
    activeUsersThisWeek: Number(activeUsers?.count ?? 0),
  };
}

export async function adminGetUserGrowth(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const rows = await db
    .select({
      date: sql<string>`date(${users.createdAt})`.as("date"),
      count: count(),
    })
    .from(users)
    .where(sql`${users.createdAt} >= ${startDate}`)
    .groupBy(sql`date(${users.createdAt})`)
    .orderBy(sql`date(${users.createdAt})`);

  return rows.map((r: any) => ({ date: r.date, count: Number(r.count) }));
}

export async function adminGetQuizAnalytics() {
  const rows = await db
    .select({
      date: sql<string>`date(${quizAttempts.createdAt})`.as("date"),
      attempts: count(),
      avgScore: sql<number>`round(avg(${quizAttempts.score}), 1)`.as(
        "avg_score",
      ),
    })
    .from(quizAttempts)
    .where(sql`${quizAttempts.createdAt} >= now() - interval '30 days'`)
    .groupBy(sql`date(${quizAttempts.createdAt})`)
    .orderBy(sql`date(${quizAttempts.createdAt})`);

  return rows.map((r: any) => ({
    date: r.date,
    attempts: Number(r.attempts),
    avgScore: Number(r.avgScore),
  }));
}

export async function adminGetContentStats() {
  // Content per book
  const bookStats = await db
    .select({
      bookId: books.id,
      bookTitle: books.title,
      chapterCount: sql<number>`count(distinct ${chapters.id})`.as(
        "chapter_count",
      ),
      topicCount: sql<number>`count(distinct ${topics.id})`.as("topic_count"),
      mcqCount: sql<number>`count(distinct ${mcqs.id})`.as("mcq_count"),
    })
    .from(books)
    .leftJoin(chapters, eq(chapters.bookId, books.id))
    .leftJoin(topics, eq(topics.chapterId, chapters.id))
    .leftJoin(mcqs, eq(mcqs.topicId, topics.id))
    .groupBy(books.id, books.title)
    .orderBy(asc(books.order));

  return bookStats.map((r: any) => ({
    bookId: r.bookId,
    bookTitle: r.bookTitle,
    chapterCount: Number(r.chapterCount),
    topicCount: Number(r.topicCount),
    mcqCount: Number(r.mcqCount),
  }));
}

// ── Announcements CRUD ────────────────────────────────────────

export async function adminGetAnnouncements(): Promise<Announcement[]> {
  return db.select().from(announcements).orderBy(desc(announcements.createdAt));
}

export async function adminCreateAnnouncement(data: {
  title: string;
  message: string;
  type?: string;
  isActive?: boolean;
  expiresAt?: Date;
  createdBy?: string;
}): Promise<Announcement> {
  const [a] = await db.insert(announcements).values(data).returning();
  return a;
}

export async function adminUpdateAnnouncement(
  id: string,
  data: Partial<{
    title: string;
    message: string;
    type: string;
    isActive: boolean;
    expiresAt: Date | null;
  }>,
): Promise<Announcement | undefined> {
  const [a] = await db
    .update(announcements)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(announcements.id, id))
    .returning();
  return a || undefined;
}

export async function adminDeleteAnnouncement(id: string): Promise<void> {
  await db.delete(announcements).where(eq(announcements.id, id));
}

// ── Audit Logs ────────────────────────────────────────────────

export async function createAuditLog(data: {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: unknown;
}): Promise<AuditLog> {
  const [log] = await db.insert(auditLogs).values(data).returning();
  return log;
}

export async function getAuditLogs(
  limit: number = 100,
  page: number = 1,
): Promise<{ data: AuditLog[]; total: number }> {
  const offset = (page - 1) * limit;
  const [totalRow] = await db.select({ total: count() }).from(auditLogs);
  const data = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return { data, total: Number(totalRow?.total ?? 0) };
}

// ── Topic Lookup helpers ──────────────────────────────────────

export async function adminGetAllTopicsFlat(): Promise<
  {
    id: string;
    title: string;
    chapterId: string;
    chapterTitle: string;
    subjectId: string | null;
    subjectTitle: string | null;
    bookId: string;
    bookTitle: string;
  }[]
> {
  return db
    .select({
      id: topics.id,
      title: topics.title,
      chapterId: chapters.id,
      chapterTitle: chapters.title,
      subjectId: subjects.id,
      subjectTitle: subjects.title,
      bookId: books.id,
      bookTitle: books.title,
    })
    .from(topics)
    .innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .innerJoin(books, eq(chapters.bookId, books.id))
    .leftJoin(subjects, eq(chapters.subjectId, subjects.id))
    .orderBy(asc(books.order), asc(chapters.order), asc(topics.order));
}
