import {
  users,
  books,
  chapters,
  topics,
  contentBlocks,
  mcqs,
  userProgress,
  bookmarks,
  quizAttempts,
  passwordResetTokens,
  recentActivity,
  reviewSchedule,
  contentReports,
  appSettings,
  announcements,
  type User,
  type InsertUser,
  type Book,
  type Chapter,
  type Topic,
  type ContentBlock,
  type MCQ,
  type UserProgress,
  type Bookmark,
  type QuizAttempt,
  type PasswordResetToken,
  type RecentActivity,
  type ReviewSchedule,
  type ContentReport,
  type AppSetting,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, avg, gt, lte, inArray } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | undefined>;

  getChaptersByBook(bookId: string): Promise<Chapter[]>;
  getChapter(id: string): Promise<Chapter | undefined>;

  getTopicsByChapter(chapterId: string): Promise<Topic[]>;
  getTopic(id: string): Promise<Topic | undefined>;

  getContentBlocksByTopic(topicId: string): Promise<ContentBlock[]>;

  getMCQsByTopic(topicId: string): Promise<MCQ[]>;
  getMCQs(limit?: number, difficulty?: string): Promise<MCQ[]>;
  getMCQ(id: string): Promise<MCQ | undefined>;

  getUserProgress(userId: string): Promise<UserProgress[]>;
  getTopicProgress(
    userId: string,
    topicId: string,
  ): Promise<UserProgress | undefined>;
  markTopicComplete(userId: string, topicId: string): Promise<void>;

  getBookmarks(userId: string): Promise<Bookmark[]>;
  toggleBookmark(userId: string, topicId: string): Promise<boolean>;
  isBookmarked(userId: string, topicId: string): Promise<boolean>;

  createQuizAttempt(
    attempt: Omit<QuizAttempt, "id" | "createdAt">,
  ): Promise<QuizAttempt>;
  getQuizAttempt(id: string): Promise<QuizAttempt | undefined>;
  getQuizAttempts(userId: string): Promise<QuizAttempt[]>;
  getQuizStats(userId: string): Promise<{
    totalAttempts: number;
    averageScore: number;
    wrongQuestionsCount: number;
  }>;
  getWrongQuestions(userId: string): Promise<MCQ[]>;

  createPasswordResetToken(userId: string): Promise<string>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenUsed(tokenId: string): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  updateUserProfile(
    userId: string,
    data: { name: string },
  ): Promise<User | undefined>;

  recordTopicView(userId: string, topicId: string): Promise<void>;
  getRecentActivity(userId: string, limit?: number): Promise<RecentActivity[]>;

  updateUserVerification(
    userId: string,
    data: {
      isEmailVerified?: boolean;
      emailVerificationToken?: string | null;
      emailTokenExpiresAt?: Date | null;
      isPhoneVerified?: boolean;
      phoneVerificationToken?: string | null;
      phoneTokenExpiresAt?: Date | null;
    },
  ): Promise<User | undefined>;

  updateUserPhoneOtp(
    userId: string,
    data: {
      phoneNumber: string;
      phoneVerificationToken: string;
      phoneTokenExpiresAt: Date;
    },
  ): Promise<User | undefined>;

  getRecommendedTopics(
    userId: string,
    limit?: number,
  ): Promise<
    {
      id: string;
      title: string;
      chapterTitle: string;
      bookTitle: string;
      progress: number;
    }[]
  >;

  getAnnouncements(): Promise<
    {
      id: string;
      title: string;
      message: string;
      type: string;
      createdAt: string;
      isRead: boolean;
    }[]
  >;

  // App Settings (admin config)
  getAppSettings(keys?: string[]): Promise<AppSetting[]>;
  getAppSetting(key: string): Promise<string | null>;
  setAppSetting(key: string, value: string): Promise<void>;
  setAppSettings(settings: { key: string; value: string }[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getBooks(): Promise<Book[]> {
    return await db
      .select()
      .from(books)
      .where(eq(books.isPublished, true))
      .orderBy(books.order);
  }

  async getBook(id: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book || undefined;
  }

  async getChaptersByBook(bookId: string): Promise<Chapter[]> {
    return await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.bookId, bookId), eq(chapters.isPublished, true)))
      .orderBy(chapters.order);
  }

  async getChapter(id: string): Promise<Chapter | undefined> {
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, id));
    return chapter || undefined;
  }

  async getTopicsByChapter(chapterId: string): Promise<Topic[]> {
    return await db
      .select()
      .from(topics)
      .where(and(eq(topics.chapterId, chapterId), eq(topics.isPublished, true)))
      .orderBy(topics.order);
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic || undefined;
  }

  async getContentBlocksByTopic(topicId: string): Promise<ContentBlock[]> {
    return await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.topicId, topicId))
      .orderBy(contentBlocks.order);
  }

  async getMCQsByTopic(topicId: string): Promise<MCQ[]> {
    return await db
      .select()
      .from(mcqs)
      .where(and(eq(mcqs.topicId, topicId), eq(mcqs.isPublished, true)));
  }

  async getMCQs(limit = 10, difficulty?: string): Promise<MCQ[]> {
    let query = db.select().from(mcqs).where(eq(mcqs.isPublished, true));
    if (difficulty && difficulty !== "all") {
      query = db
        .select()
        .from(mcqs)
        .where(
          and(eq(mcqs.isPublished, true), eq(mcqs.difficulty, difficulty)),
        );
    }
    return await query.limit(limit).orderBy(sql`RANDOM()`);
  }

  async getMCQ(id: string): Promise<MCQ | undefined> {
    const [mcq] = await db.select().from(mcqs).where(eq(mcqs.id, id));
    return mcq || undefined;
  }

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId));
  }

  async getTopicProgress(
    userId: string,
    topicId: string,
  ): Promise<UserProgress | undefined> {
    const [progress] = await db
      .select()
      .from(userProgress)
      .where(
        and(eq(userProgress.userId, userId), eq(userProgress.topicId, topicId)),
      );
    return progress || undefined;
  }

  async markTopicComplete(userId: string, topicId: string): Promise<void> {
    const existing = await this.getTopicProgress(userId, topicId);
    if (existing) {
      await db
        .update(userProgress)
        .set({ isCompleted: true, completedAt: new Date() })
        .where(eq(userProgress.id, existing.id));
    } else {
      await db.insert(userProgress).values({
        userId,
        topicId,
        isCompleted: true,
        completedAt: new Date(),
      });
    }
  }

  async markTopicUncomplete(userId: string, topicId: string): Promise<void> {
    const existing = await this.getTopicProgress(userId, topicId);
    if (existing) {
      await db
        .update(userProgress)
        .set({ isCompleted: false, completedAt: null })
        .where(eq(userProgress.id, existing.id));
    }
  }

  async getBookmarks(userId: string): Promise<Bookmark[]> {
    return await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  }

  async toggleBookmark(userId: string, topicId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.topicId, topicId)));

    if (existing) {
      await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
      return false;
    } else {
      await db.insert(bookmarks).values({ userId, topicId });
      return true;
    }
  }

  async isBookmarked(userId: string, topicId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.topicId, topicId)));
    return !!existing;
  }

  async createQuizAttempt(
    attempt: Omit<QuizAttempt, "id" | "createdAt">,
  ): Promise<QuizAttempt> {
    const [result] = await db.insert(quizAttempts).values(attempt).returning();
    return result;
  }

  async getQuizAttempt(id: string): Promise<QuizAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, id));
    return attempt || undefined;
  }

  async getQuizAttempts(userId: string): Promise<QuizAttempt[]> {
    return await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.createdAt));
  }

  async getQuizStats(userId: string): Promise<{
    totalAttempts: number;
    averageScore: number;
    wrongQuestionsCount: number;
  }> {
    const attempts = await this.getQuizAttempts(userId);
    const totalAttempts = attempts.length;
    const averageScore =
      totalAttempts > 0
        ? Math.round(
            attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts,
          )
        : 0;

    let wrongQuestionsCount = 0;
    for (const attempt of attempts) {
      wrongQuestionsCount += attempt.wrongCount;
    }

    return { totalAttempts, averageScore, wrongQuestionsCount };
  }

  async getWrongQuestions(userId: string): Promise<MCQ[]> {
    const attempts = await this.getQuizAttempts(userId);

    // Sort attempts by date (oldest first) to process in chronological order
    const sortedAttempts = [...attempts].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // Track the latest result for each question
    // Process from oldest to newest so latest answer overwrites
    const questionStatus = new Map<string, boolean>();

    for (const attempt of sortedAttempts) {
      const answers = attempt.answers as Record<
        string,
        { selected: string; correct: string; isCorrect: boolean }
      >;
      for (const [mcqId, answer] of Object.entries(answers)) {
        questionStatus.set(mcqId, answer.isCorrect);
      }
    }

    // Get only questions that are still marked as wrong (not corrected in later attempts)
    const wrongIds: string[] = [];
    for (const [mcqId, isCorrect] of questionStatus.entries()) {
      if (!isCorrect) {
        wrongIds.push(mcqId);
      }
    }

    if (wrongIds.length === 0) return [];

    const allMcqs = await db
      .select()
      .from(mcqs)
      .where(eq(mcqs.isPublished, true));
    return allMcqs.filter((m) => wrongIds.includes(m.id));
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  /** Store a 6-digit OTP for password reset (in the same table, using `token` column) */
  async createPasswordResetOtp(userId: string, otp: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
    await db.insert(passwordResetTokens).values({
      userId,
      token: otp,
      expiresAt,
    });
  }

  async getPasswordResetToken(
    token: string,
  ): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      );
    return resetToken || undefined;
  }

  /** Look up a password reset OTP by the user's email + OTP code */
  async getPasswordResetByOtp(
    email: string,
    otp: string,
  ): Promise<PasswordResetToken | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    if (!user) return undefined;

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.token, otp),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      );
    return resetToken || undefined;
  }

  async markTokenUsed(tokenId: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  async updateUserPassword(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async updateUserProfile(
    userId: string,
    data: { name: string },
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ name: data.name })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async recordTopicView(userId: string, topicId: string): Promise<void> {
    // Check if there's an existing view for this topic by this user
    const [existing] = await db
      .select()
      .from(recentActivity)
      .where(
        and(
          eq(recentActivity.userId, userId),
          eq(recentActivity.topicId, topicId),
        ),
      );

    if (existing) {
      // Update the viewedAt timestamp
      await db
        .update(recentActivity)
        .set({ viewedAt: new Date() })
        .where(eq(recentActivity.id, existing.id));
    } else {
      // Create a new record
      await db.insert(recentActivity).values({ userId, topicId });
    }
  }

  async getRecentActivity(
    userId: string,
    limit: number = 20,
  ): Promise<RecentActivity[]> {
    return await db
      .select()
      .from(recentActivity)
      .where(eq(recentActivity.userId, userId))
      .orderBy(desc(recentActivity.viewedAt))
      .limit(limit);
  }

  async updateUserVerification(
    userId: string,
    data: {
      isEmailVerified?: boolean;
      emailVerificationToken?: string | null;
      emailTokenExpiresAt?: Date | null;
      isPhoneVerified?: boolean;
      phoneVerificationToken?: string | null;
      phoneTokenExpiresAt?: Date | null;
    },
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async updateUserPhoneOtp(
    userId: string,
    data: {
      phoneNumber: string;
      phoneVerificationToken: string;
      phoneTokenExpiresAt: Date;
    },
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  // ── Efficient batch queries (P1 — eliminate N+1) ──────────────────────

  /** Get all chapters with topic counts using LEFT JOIN + GROUP BY */
  async getAllChaptersGroupedByBook(): Promise<
    {
      bookId: string;
      chapterId: string;
      chapterTitle: string;
      chapterDescription: string | null;
      chapterOrder: number | null;
      topicCount: number;
    }[]
  > {
    const rows = await db
      .select({
        bookId: chapters.bookId,
        chapterId: chapters.id,
        chapterTitle: chapters.title,
        chapterDescription: chapters.description,
        chapterOrder: chapters.order,
        topicCount: sql<number>`cast(count(${topics.id}) as int)`.as(
          "topic_count",
        ),
      })
      .from(chapters)
      .leftJoin(
        topics,
        and(eq(topics.chapterId, chapters.id), eq(topics.isPublished, true)),
      )
      .where(eq(chapters.isPublished, true))
      .groupBy(
        chapters.bookId,
        chapters.id,
        chapters.title,
        chapters.description,
        chapters.order,
      )
      .orderBy(chapters.order);
    return rows;
  }

  /** Get all topics for a book (across all its chapters) in one query */
  async getTopicsByBook(bookId: string): Promise<Topic[]> {
    return await db
      .select({ topic: topics })
      .from(topics)
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .where(and(eq(chapters.bookId, bookId), eq(topics.isPublished, true)))
      .orderBy(chapters.order, topics.order)
      .then((rows) => rows.map((r) => r.topic));
  }

  /** Full-text search using SQL ILIKE — no table scan */
  async searchContent(
    query: string,
    filter: string,
    limit: number = 50,
  ): Promise<
    {
      id: string;
      type: "book" | "chapter" | "topic";
      title: string;
      subtitle: string;
      bookId?: string;
      bookTitle?: string;
      chapterId?: string;
      chapterTitle?: string;
    }[]
  > {
    const pattern = `%${query}%`;
    const results: any[] = [];

    if (filter === "all" || filter === "books") {
      const bookResults = await db
        .select()
        .from(books)
        .where(
          and(
            eq(books.isPublished, true),
            sql`(${books.title} ILIKE ${pattern} OR ${books.description} ILIKE ${pattern})`,
          ),
        )
        .limit(limit);
      for (const b of bookResults) {
        results.push({
          id: b.id,
          type: "book" as const,
          title: b.title,
          subtitle: b.description || "Book",
        });
      }
    }

    if (filter === "all" || filter === "chapters") {
      const chapterResults = await db
        .select({
          chapterId: chapters.id,
          chapterTitle: chapters.title,
          chapterDescription: chapters.description,
          bookId: books.id,
          bookTitle: books.title,
        })
        .from(chapters)
        .innerJoin(books, eq(chapters.bookId, books.id))
        .where(
          and(
            eq(chapters.isPublished, true),
            sql`(${chapters.title} ILIKE ${pattern} OR ${chapters.description} ILIKE ${pattern})`,
          ),
        )
        .limit(limit);
      for (const c of chapterResults) {
        results.push({
          id: c.chapterId,
          type: "chapter" as const,
          title: c.chapterTitle,
          subtitle: c.bookTitle,
          bookId: c.bookId,
          bookTitle: c.bookTitle,
        });
      }
    }

    if (filter === "all" || filter === "topics") {
      const topicResults = await db
        .select({
          topicId: topics.id,
          topicTitle: topics.title,
          topicDescription: topics.description,
          chapterId: chapters.id,
          chapterTitle: chapters.title,
          bookId: books.id,
          bookTitle: books.title,
        })
        .from(topics)
        .innerJoin(chapters, eq(topics.chapterId, chapters.id))
        .innerJoin(books, eq(chapters.bookId, books.id))
        .where(
          and(
            eq(topics.isPublished, true),
            sql`(${topics.title} ILIKE ${pattern} OR ${topics.description} ILIKE ${pattern})`,
          ),
        )
        .limit(limit);
      for (const t of topicResults) {
        results.push({
          id: t.topicId,
          type: "topic" as const,
          title: t.topicTitle,
          subtitle: `${t.bookTitle} > ${t.chapterTitle}`,
          bookId: t.bookId,
          bookTitle: t.bookTitle,
          chapterId: t.chapterId,
          chapterTitle: t.chapterTitle,
        });
      }
    }

    return results.slice(0, limit);
  }

  /** Get quiz topics with question counts using a JOIN instead of N+1 */
  async getQuizTopicsWithCounts(): Promise<
    { id: string; title: string; chapterTitle: string; questionCount: number }[]
  > {
    const rows = await db
      .select({
        topicId: topics.id,
        topicTitle: topics.title,
        chapterTitle: chapters.title,
        questionCount: sql<number>`count(${mcqs.id})`.as("question_count"),
      })
      .from(topics)
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .innerJoin(mcqs, eq(mcqs.topicId, topics.id))
      .where(and(eq(topics.isPublished, true), eq(mcqs.isPublished, true)))
      .groupBy(topics.id, topics.title, chapters.title)
      .having(sql`count(${mcqs.id}) > 0`);

    return rows.map((r) => ({
      id: r.topicId,
      title: r.topicTitle,
      chapterTitle: r.chapterTitle,
      questionCount: Number(r.questionCount),
    }));
  }

  /** Get multiple MCQs by ID in one query (batch for quiz results) */
  async getMCQsByIds(ids: string[]): Promise<MCQ[]> {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(mcqs)
      .where(sql`${mcqs.id} IN ${ids}`);
  }

  /** Get bookmarks with full topic→chapter→book details via JOINs */
  async getBookmarksWithDetails(userId: string): Promise<
    {
      id: string;
      topicId: string;
      topicTitle: string;
      chapterTitle: string;
      bookTitle: string;
      createdAt: Date;
    }[]
  > {
    return await db
      .select({
        id: bookmarks.id,
        topicId: topics.id,
        topicTitle: topics.title,
        chapterTitle: chapters.title,
        bookTitle: books.title,
        createdAt: bookmarks.createdAt,
      })
      .from(bookmarks)
      .innerJoin(topics, eq(bookmarks.topicId, topics.id))
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .innerJoin(books, eq(chapters.bookId, books.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  }

  /** Get recent activity with full topic→chapter→book details via JOINs */
  async getRecentActivityWithDetails(
    userId: string,
    limit: number = 20,
  ): Promise<
    {
      id: string;
      topicId: string;
      topicTitle: string;
      chapterTitle: string;
      bookTitle: string;
      viewedAt: Date;
    }[]
  > {
    return await db
      .select({
        id: recentActivity.id,
        topicId: topics.id,
        topicTitle: topics.title,
        chapterTitle: chapters.title,
        bookTitle: books.title,
        viewedAt: recentActivity.viewedAt,
      })
      .from(recentActivity)
      .innerJoin(topics, eq(recentActivity.topicId, topics.id))
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .innerJoin(books, eq(chapters.bookId, books.id))
      .where(eq(recentActivity.userId, userId))
      .orderBy(desc(recentActivity.viewedAt))
      .limit(limit);
  }

  /** Get quiz attempts with pagination */
  async getQuizAttemptsPaginated(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{
    data: QuizAttempt[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const offset = (page - 1) * pageSize;

    const [totalResult] = await db
      .select({ total: count() })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));

    const data = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total: Number(totalResult?.total ?? 0),
      page,
      pageSize,
    };
  }

  // ── Spaced Repetition (SM-2) ──────────────────────────────────

  /** Get cards due for review */
  async getDueReviews(
    userId: string,
    limit: number = 20,
  ): Promise<ReviewSchedule[]> {
    return await db
      .select()
      .from(reviewSchedule)
      .where(
        and(
          eq(reviewSchedule.userId, userId),
          lte(reviewSchedule.nextReviewAt, new Date()),
        ),
      )
      .orderBy(reviewSchedule.nextReviewAt)
      .limit(limit);
  }

  /** Get or create a review schedule entry */
  async getOrCreateReview(
    userId: string,
    mcqId: string,
  ): Promise<ReviewSchedule> {
    const [existing] = await db
      .select()
      .from(reviewSchedule)
      .where(
        and(eq(reviewSchedule.userId, userId), eq(reviewSchedule.mcqId, mcqId)),
      );

    if (existing) return existing;

    const [created] = await db
      .insert(reviewSchedule)
      .values({ userId, mcqId })
      .returning();
    return created;
  }

  /** Update review schedule after answering (SM-2 algorithm) */
  async updateReview(
    reviewId: string,
    quality: number, // 0-5 quality rating
  ): Promise<ReviewSchedule> {
    const [review] = await db
      .select()
      .from(reviewSchedule)
      .where(eq(reviewSchedule.id, reviewId));

    if (!review) throw new Error("Review not found");

    let { easeFactor, interval, repetitions } = review;
    const ef = easeFactor / 100; // convert back to decimal

    // SM-2 algorithm
    if (quality >= 3) {
      // Correct answer
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ef);
      }
      repetitions++;
    } else {
      // Incorrect — reset
      repetitions = 0;
      interval = 1;
    }

    // Update ease factor
    const newEf = Math.max(
      1.3,
      ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    const [updated] = await db
      .update(reviewSchedule)
      .set({
        easeFactor: Math.round(newEf * 100),
        interval,
        repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
      })
      .where(eq(reviewSchedule.id, reviewId))
      .returning();

    return updated;
  }

  /** Count due reviews for a user */
  async getDueReviewCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(reviewSchedule)
      .where(
        and(
          eq(reviewSchedule.userId, userId),
          lte(reviewSchedule.nextReviewAt, new Date()),
        ),
      );
    return Number(result?.count ?? 0);
  }

  // ── Content Error Reports ─────────────────────────────────────

  /** Create a content error report */
  async createContentReport(data: {
    userId: string;
    contentType: string;
    contentId: string;
    reportType: string;
    description: string;
  }): Promise<ContentReport> {
    const [report] = await db.insert(contentReports).values(data).returning();
    return report;
  }

  /** Get content reports (for admin) */
  async getContentReports(
    status?: string,
    limit: number = 50,
  ): Promise<ContentReport[]> {
    let query = db
      .select()
      .from(contentReports)
      .orderBy(desc(contentReports.createdAt))
      .limit(limit);
    if (status) {
      return await db
        .select()
        .from(contentReports)
        .where(eq(contentReports.status, status))
        .orderBy(desc(contentReports.createdAt))
        .limit(limit);
    }
    return await query;
  }

  /** Update report status */
  async updateContentReportStatus(
    reportId: string,
    status: string,
    reviewedBy: string,
  ): Promise<ContentReport | undefined> {
    const [updated] = await db
      .update(contentReports)
      .set({ status, reviewedBy, reviewedAt: new Date() })
      .where(eq(contentReports.id, reportId))
      .returning();
    return updated || undefined;
  }

  /** Get recommended topics: incomplete topics from books the user has been active in */
  async getRecommendedTopics(
    userId: string,
    limit: number = 5,
  ): Promise<
    {
      id: string;
      title: string;
      chapterTitle: string;
      bookTitle: string;
      progress: number;
    }[]
  > {
    // Find topics user hasn't completed, ordered by book activity
    const result = await db
      .select({
        id: topics.id,
        title: topics.title,
        chapterTitle: chapters.title,
        bookTitle: books.title,
      })
      .from(topics)
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .innerJoin(books, eq(chapters.bookId, books.id))
      .where(
        and(
          eq(topics.isPublished, true),
          eq(chapters.isPublished, true),
          eq(books.isPublished, true),
          sql`${topics.id} NOT IN (
            SELECT ${userProgress.topicId} FROM ${userProgress}
            WHERE ${userProgress.userId} = ${userId} AND ${userProgress.isCompleted} = true
          )`,
        ),
      )
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    return result.map((r) => ({
      id: r.id,
      title: r.title,
      chapterTitle: r.chapterTitle,
      bookTitle: r.bookTitle,
      progress: 0,
    }));
  }

  /** Get active, non-expired announcements for mobile users */
  async getAnnouncements(): Promise<
    {
      id: string;
      title: string;
      message: string;
      type: string;
      createdAt: string;
    }[]
  > {
    const now = new Date();
    const rows = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.isActive, true),
          sql`(${announcements.expiresAt} IS NULL OR ${announcements.expiresAt} > ${now})`,
        ),
      )
      .orderBy(desc(announcements.createdAt));
    return rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      message: r.message,
      type: r.type,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ── App Settings ──────────────────────────

  async getAppSettings(keys?: string[]): Promise<AppSetting[]> {
    if (keys && keys.length > 0) {
      return db
        .select()
        .from(appSettings)
        .where(inArray(appSettings.key, keys));
    }
    return db.select().from(appSettings);
  }

  async getAppSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key));
    return setting?.value ?? null;
  }

  async setAppSetting(key: string, value: string): Promise<void> {
    const existing = await this.getAppSetting(key);
    if (existing !== null) {
      await db
        .update(appSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value });
    }
  }

  async setAppSettings(
    settings: { key: string; value: string }[],
  ): Promise<void> {
    for (const { key, value } of settings) {
      await this.setAppSetting(key, value);
    }
  }
}

export const storage = new DatabaseStorage();
