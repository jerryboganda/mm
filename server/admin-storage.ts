/**
 * Admin-specific storage methods for content CRUD, user management,
 * analytics, announcements, and audit logging.
 */
import {
  users,
  books,
  chapters,
  topics,
  contentBlocks,
  mcqs,
  userProgress,
  quizAttempts,
  announcements,
  auditLogs,
  contentReports,
  recentActivity,
  type Book,
  type Chapter,
  type Topic,
  type ContentBlock,
  type MCQ,
  type User,
  type Announcement,
  type AuditLog,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, count, ilike, or } from "drizzle-orm";

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
  description?: string;
  imageUrl?: string;
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
  data: Partial<{ title: string; description: string; imageUrl: string; isPublished: boolean; order: number }>,
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

export async function adminGetChapter(id: string): Promise<Chapter | undefined> {
  const [ch] = await db.select().from(chapters).where(eq(chapters.id, id));
  return ch || undefined;
}

export async function adminCreateChapter(data: {
  bookId: string;
  title: string;
  description?: string;
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
  data: Partial<{ title: string; description: string; isPublished: boolean; order: number; bookId: string }>,
): Promise<Chapter | undefined> {
  const [ch] = await db.update(chapters).set(data).where(eq(chapters.id, id)).returning();
  return ch || undefined;
}

export async function adminDeleteChapter(id: string): Promise<void> {
  await db.delete(chapters).where(eq(chapters.id, id));
}

export async function adminReorderChapters(bookId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(chapters).set({ order: i }).where(and(eq(chapters.id, orderedIds[i]), eq(chapters.bookId, bookId)));
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
  description?: string;
  isPublished?: boolean;
  order?: number;
  author?: string;
  source?: string;
  references?: string;
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
    description: string;
    isPublished: boolean;
    order: number;
    chapterId: string;
    author: string;
    source: string;
    references: string;
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

export async function adminReorderTopics(chapterId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(topics).set({ order: i }).where(and(eq(topics.id, orderedIds[i]), eq(topics.chapterId, chapterId)));
  }
}

// ── Content Blocks CRUD ───────────────────────────────────────

export async function adminGetContentBlocks(topicId: string): Promise<ContentBlock[]> {
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
      .select({ maxOrder: sql<number>`coalesce(max(${contentBlocks.order}), -1)` })
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
  const [cb] = await db.update(contentBlocks).set(data).where(eq(contentBlocks.id, id)).returning();
  return cb || undefined;
}

export async function adminDeleteContentBlock(id: string): Promise<void> {
  await db.delete(contentBlocks).where(eq(contentBlocks.id, id));
}

export async function adminReorderContentBlocks(topicId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(contentBlocks).set({ order: i }).where(and(eq(contentBlocks.id, orderedIds[i]), eq(contentBlocks.topicId, topicId)));
  }
}

// ── MCQs CRUD ─────────────────────────────────────────────────

export async function adminGetMcqs(filters?: {
  topicId?: string;
  difficulty?: string;
  isPublished?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: MCQ[]; total: number }> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions: any[] = [];
  if (filters?.topicId) conditions.push(eq(mcqs.topicId, filters.topicId));
  if (filters?.difficulty) conditions.push(eq(mcqs.difficulty, filters.difficulty));
  if (filters?.isPublished !== undefined) conditions.push(eq(mcqs.isPublished, filters.isPublished));
  if (filters?.search) conditions.push(ilike(mcqs.question, `%${filters.search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(mcqs).where(where);
  const data = await db
    .select()
    .from(mcqs)
    .where(where)
    .orderBy(desc(mcqs.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total: Number(totalRow?.total ?? 0) };
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
  explanation?: string;
  optionExplanations?: unknown;
  difficulty?: string;
  references?: string;
  tags?: unknown;
  isPublished?: boolean;
}): Promise<MCQ> {
  const [m] = await db.insert(mcqs).values(data).returning();
  return m;
}

export async function adminUpdateMcq(
  id: string,
  data: Partial<{
    question: string;
    options: unknown;
    correctAnswer: string;
    explanation: string;
    optionExplanations: unknown;
    difficulty: string;
    references: string;
    tags: unknown;
    isPublished: boolean;
    topicId: string;
  }>,
): Promise<MCQ | undefined> {
  const [m] = await db
    .update(mcqs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(mcqs.id, id))
    .returning();
  return m || undefined;
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
    explanation?: string;
    optionExplanations?: unknown;
    difficulty?: string;
    references?: string;
    tags?: unknown;
    isPublished?: boolean;
  }[],
): Promise<number> {
  if (mcqList.length === 0) return 0;
  const result = await db.insert(mcqs).values(mcqList).returning();
  return result.length;
}

// ── Users Management ──────────────────────────────────────────

export async function adminGetUsers(filters?: {
  search?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: Omit<User, "password">[]; total: number }> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions: any[] = [];
  if (filters?.role) conditions.push(eq(users.role, filters.role));
  if (filters?.search) {
    conditions.push(
      or(ilike(users.name, `%${filters.search}%`), ilike(users.email, `%${filters.search}%`)),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(users).where(where);
  const data = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      password: sql<string>`'***'`.as("password"),
      subscriptionStatus: users.subscriptionStatus,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionExpiresAt: users.subscriptionExpiresAt,
      createdAt: users.createdAt,
      isEmailVerified: users.isEmailVerified,
      emailVerificationToken: users.emailVerificationToken,
      emailTokenExpiresAt: users.emailTokenExpiresAt,
      phoneNumber: users.phoneNumber,
      isPhoneVerified: users.isPhoneVerified,
      phoneVerificationToken: users.phoneVerificationToken,
      phoneTokenExpiresAt: users.phoneTokenExpiresAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total: Number(totalRow?.total ?? 0) };
}

export async function adminGetUserDetail(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return undefined;

  const [progressCount] = await db
    .select({ count: count() })
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)));

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
  }>,
): Promise<User | undefined> {
  const [user] = await db.update(users).set(data).where(eq(users.id, userId)).returning();
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
  const [totalAttempts] = await db.select({ count: count() }).from(quizAttempts);
  const [publishedBooks] = await db.select({ count: count() }).from(books).where(eq(books.isPublished, true));
  const [publishedTopics] = await db.select({ count: count() }).from(topics).where(eq(topics.isPublished, true));
  const [publishedMcqs] = await db.select({ count: count() }).from(mcqs).where(eq(mcqs.isPublished, true));
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

  return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

export async function adminGetQuizAnalytics() {
  const rows = await db
    .select({
      date: sql<string>`date(${quizAttempts.createdAt})`.as("date"),
      attempts: count(),
      avgScore: sql<number>`round(avg(${quizAttempts.score}), 1)`.as("avg_score"),
    })
    .from(quizAttempts)
    .where(sql`${quizAttempts.createdAt} >= now() - interval '30 days'`)
    .groupBy(sql`date(${quizAttempts.createdAt})`)
    .orderBy(sql`date(${quizAttempts.createdAt})`);

  return rows.map((r) => ({
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
      chapterCount: sql<number>`count(distinct ${chapters.id})`.as("chapter_count"),
      topicCount: sql<number>`count(distinct ${topics.id})`.as("topic_count"),
      mcqCount: sql<number>`count(distinct ${mcqs.id})`.as("mcq_count"),
    })
    .from(books)
    .leftJoin(chapters, eq(chapters.bookId, books.id))
    .leftJoin(topics, eq(topics.chapterId, chapters.id))
    .leftJoin(mcqs, eq(mcqs.topicId, topics.id))
    .groupBy(books.id, books.title)
    .orderBy(asc(books.order));

  return bookStats.map((r) => ({
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
  { id: string; title: string; chapterTitle: string; bookTitle: string }[]
> {
  return db
    .select({
      id: topics.id,
      title: topics.title,
      chapterTitle: chapters.title,
      bookTitle: books.title,
    })
    .from(topics)
    .innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .innerJoin(books, eq(chapters.bookId, books.id))
    .orderBy(asc(books.order), asc(chapters.order), asc(topics.order));
}
