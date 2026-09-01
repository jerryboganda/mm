import {
  users,
  books,
  subjects,
  chapters,
  topics,
  contentBlocks,
  mcqs,
  sources,
  mcqStats,
  userProgress,
  bookmarks,
  quizAttempts,
  passwordResetTokens,
  recentActivity,
  reviewSchedule,
  contentReports,
  appSettings,
  announcements,
  waitlistEntries,
  contactMessages,
  institutionalRequests,
  newsletterEntries,
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
  type WaitlistEntry,
  type ContactMessage,
  type InstitutionalRequest,
  type NewsletterEntry,
} from "../shared/schema";
import { db, isMysql } from "./db";
import { eq, and, asc, desc, sql, count, gt, lte, inArray } from "drizzle-orm";
import crypto from "crypto";

/**
 * Storage interface defining all data-access operations for the application.
 * Implementations must provide persistence for users, content, progress, quizzes, and settings.
 */
export interface IStorage {
  /**
   * Retrieve a user by their unique ID.
   * @param id - The user's UUID
   * @returns The user record, or undefined if not found
   */
  getUser(id: string): Promise<User | undefined>;

  /**
   * Retrieve a user by their email address.
   * @param email - The user's email
   * @returns The user record, or undefined if no user has that email
   */
  getUserByEmail(email: string): Promise<User | undefined>;

  /**
   * Create a new user account.
   * @param user - The user data to insert
   * @returns The newly created user record
   */
  createUser(user: InsertUser): Promise<User>;

  /**
   * Retrieve all published books, ordered by their display order.
   * @returns An array of published books
   */
  getBooks(): Promise<Book[]>;

  /**
   * Retrieve a single book by its ID.
   * @param id - The book's UUID
   * @returns The book record, or undefined if not found
   */
  getBook(id: string): Promise<Book | undefined>;

  /**
   * Retrieve all published chapters belonging to a specific book.
   * @param bookId - The parent book's UUID
   * @returns An array of chapters ordered by display order
   */
  getChaptersByBook(bookId: string): Promise<Chapter[]>;

  /**
   * Retrieve a single chapter by its ID.
   * @param id - The chapter's UUID
   * @returns The chapter record, or undefined if not found
   */
  getChapter(id: string): Promise<Chapter | undefined>;

  /**
   * Retrieve all published topics belonging to a specific chapter.
   * @param chapterId - The parent chapter's UUID
   * @returns An array of topics ordered by display order
   */
  getTopicsByChapter(chapterId: string): Promise<Topic[]>;

  /**
   * Retrieve a single topic by its ID.
   * @param id - The topic's UUID
   * @returns The topic record, or undefined if not found
   */
  getTopic(id: string): Promise<Topic | undefined>;

  /**
   * Retrieve all content blocks for a topic, ordered by display order.
   * @param topicId - The parent topic's UUID
   * @returns An array of content blocks
   */
  getContentBlocksByTopic(topicId: string): Promise<ContentBlock[]>;

  /**
   * Retrieve all published MCQs belonging to a specific topic, in stable
   * creation order, optionally narrowed by year/source.
   * @param topicId - The parent topic's UUID
   * @param opts - Optional year/sourceId filters
   * @returns An array of MCQ records
   */
  getMCQsByTopic(
    topicId: string,
    opts?: { year?: number; sourceId?: string },
  ): Promise<MCQ[]>;

  /**
   * Retrieve a random set of published MCQs, optionally filtered by difficulty.
   * @param limit - Maximum number of MCQs to return (default varies by implementation)
   * @param difficulty - Difficulty level filter; pass "all" or omit to include all difficulties
   * @param opts - Optional year/sourceId filters
   * @returns An array of MCQ records in random order
   */
  getMCQs(
    limit?: number,
    difficulty?: string,
    opts?: { year?: number; sourceId?: string },
  ): Promise<MCQ[]>;

  /**
   * Batch-fetch classification metadata (year, source, subject) for MCQs.
   */
  getMCQMetadataByIds(ids: string[]): Promise<
    Map<
      string,
      {
        year: number | null;
        sourceName: string | null;
        subjectName: string | null;
      }
    >
  >;

  /**
   * Available student-side filter options (years + sources present in the
   * published, non-archived question bank).
   */
  getQuizFilterOptions(): Promise<{
    years: number[];
    sources: { id: string; name: string }[];
  }>;

  /**
   * Increment per-MCQ attempt stats after a quiz submission.
   * @param results - Map of mcqId -> isCorrect
   */
  recordMcqStats(results: Record<string, boolean>): Promise<void>;

  /**
   * Retrieve a single MCQ by its ID.
   * @param id - The MCQ's UUID
   * @returns The MCQ record, or undefined if not found
   */
  getMCQ(id: string): Promise<MCQ | undefined>;

  /**
   * Retrieve all progress records for a user across all topics.
   * @param userId - The user's UUID
   * @returns An array of user progress records
   */
  getUserProgress(userId: string): Promise<UserProgress[]>;

  /**
   * Retrieve progress for a specific user on a specific topic.
   * @param userId - The user's UUID
   * @param topicId - The topic's UUID
   * @returns The progress record, or undefined if none exists
   */
  getTopicProgress(
    userId: string,
    topicId: string,
  ): Promise<UserProgress | undefined>;

  /**
   * Mark a topic as completed for a user. Creates a progress record if none exists.
   * @param userId - The user's UUID
   * @param topicId - The topic's UUID
   */
  markTopicComplete(userId: string, topicId: string): Promise<void>;

  /**
   * Retrieve all bookmarks for a user, ordered by most recently created first.
   * @param userId - The user's UUID
   * @returns An array of bookmark records
   */
  getBookmarks(userId: string): Promise<Bookmark[]>;

  /**
   * Toggle a bookmark for a user on a topic. Creates the bookmark if it doesn't exist, removes it if it does.
   * @param userId - The user's UUID
   * @param topicId - The topic's UUID
   * @returns `true` if the bookmark was created, `false` if it was removed
   */
  toggleBookmark(userId: string, topicId: string): Promise<boolean>;

  /**
   * Check whether a user has bookmarked a specific topic.
   * @param userId - The user's UUID
   * @param topicId - The topic's UUID
   * @returns `true` if the topic is bookmarked
   */
  isBookmarked(userId: string, topicId: string): Promise<boolean>;

  /**
   * Record a new quiz attempt.
   * @param attempt - The quiz attempt data (id and createdAt are auto-generated)
   * @returns The newly created quiz attempt record
   */
  createQuizAttempt(
    attempt: Omit<QuizAttempt, "id" | "createdAt">,
  ): Promise<QuizAttempt>;

  /**
   * Retrieve a single quiz attempt by its ID.
   * @param id - The quiz attempt's UUID
   * @returns The quiz attempt record, or undefined if not found
   */
  getQuizAttempt(id: string): Promise<QuizAttempt | undefined>;

  /**
   * Retrieve all quiz attempts for a user, ordered by most recent first.
   * @param userId - The user's UUID
   * @returns An array of quiz attempt records
   */
  getQuizAttempts(userId: string): Promise<QuizAttempt[]>;

  /**
   * Compute aggregate quiz statistics for a user.
   * @param userId - The user's UUID
   * @returns An object containing totalAttempts, averageScore, and wrongQuestionsCount
   */
  getQuizStats(userId: string): Promise<{
    totalAttempts: number;
    averageScore: number;
    wrongQuestionsCount: number;
  }>;

  /**
   * Retrieve MCQs that the user answered incorrectly and has not yet corrected in a later attempt.
   * @param userId - The user's UUID
   * @returns An array of MCQ records the user still has wrong
   */
  getWrongQuestions(userId: string): Promise<MCQ[]>;

  /**
   * Generate and store a cryptographically random password-reset token for a user.
   * @param userId - The user's UUID
   * @returns The generated hex token string (valid for 1 hour)
   */
  createPasswordResetToken(userId: string): Promise<string>;

  /**
   * Look up a valid (unused, non-expired) password-reset token.
   * @param token - The token string to look up
   * @returns The token record, or undefined if invalid/expired/used
   */
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;

  /**
   * Mark a password-reset token as used so it cannot be reused.
   * @param tokenId - The token record's UUID
   */
  markTokenUsed(tokenId: string): Promise<void>;

  /**
   * Update a user's password hash.
   * @param userId - The user's UUID
   * @param hashedPassword - The new bcrypt-hashed password
   */
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;

  /**
   * Update a user's profile information.
   * @param userId - The user's UUID
   * @param data - An object containing the fields to update
   * @returns The updated user record, or undefined if the user was not found
   */
  updateUserProfile(
    userId: string,
    data: { name: string; avatarUrl?: string | null },
  ): Promise<User | undefined>;

  /**
   * Update a user's subscription status and plan details.
   * @param userId - The user's UUID
   * @param data - Subscription fields to update
   * @returns The updated user record, or undefined if the user was not found
   */
  updateSubscription(
    userId: string,
    data: {
      subscriptionStatus: string;
      subscriptionPlan?: string;
      subscriptionExpiresAt?: Date | null;
    },
  ): Promise<User | undefined>;

  /**
   * Deactivate a user's account, optionally recording a reason.
   * @param userId - The user's UUID
   * @param reason - Optional reason for deactivation
   * @returns The updated user record, or undefined if the user was not found
   */
  deactivateUser(userId: string, reason?: string): Promise<User | undefined>;

  /**
   * Request deletion of a user's account. Sets the deletion status to "requested".
   * @param userId - The user's UUID
   * @param note - Optional note from the user about the deletion request
   * @returns The updated user record, or undefined if the user was not found
   */
  requestAccountDeletion(
    userId: string,
    note?: string,
  ): Promise<User | undefined>;

  /**
   * Record that a user viewed a topic. Updates the timestamp if a record already exists.
   * @param userId - The user's UUID
   * @param topicId - The topic's UUID
   */
  recordTopicView(userId: string, topicId: string): Promise<void>;

  /**
   * Retrieve recent topic-view activity for a user, ordered by most recent first.
   * @param userId - The user's UUID
   * @param limit - Maximum number of records to return (default varies by implementation)
   * @returns An array of recent activity records
   */
  getRecentActivity(userId: string, limit?: number): Promise<RecentActivity[]>;

  /**
   * Update a user's email verification status and/or verification token.
   * @param userId - The user's UUID
   * @param data - Verification fields to update
   * @returns The updated user record, or undefined if the user was not found
   */
  updateUserVerification(
    userId: string,
    data: {
      isEmailVerified?: boolean;
      emailVerificationToken?: string | null;
      emailTokenExpiresAt?: Date | null;
    },
  ): Promise<User | undefined>;

  /**
   * Get recommended (incomplete) topics for a user, drawn randomly from published content.
   * @param userId - The user's UUID
   * @param limit - Maximum number of recommendations to return
   * @returns An array of topic recommendations with hierarchy info and progress
   */
  getRecommendedTopics(
    userId: string,
    limit?: number,
  ): Promise<
    {
      id: string;
      title: string;
      chapterTitle: string;
      bookTitle: string;
      isPaid: boolean;
      progress: number;
    }[]
  >;

  /**
   * Retrieve all active, non-expired announcements for display to users (including targeted notifications).
   * @param userId Optional user ID to include targeted user notifications
   * @returns An array of announcement objects with isRead defaulting to false
   */
  getAnnouncements(userId?: string): Promise<
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

  /**
   * Retrieve application settings, optionally filtered by keys.
   * @param keys - Optional array of setting keys to filter by. If omitted, all settings are returned.
   * @returns An array of app setting records
   */
  getAppSettings(keys?: string[]): Promise<AppSetting[]>;

  /**
   * Retrieve the value of a single application setting.
   * @param key - The setting key
   * @returns The setting value, or null if the key does not exist
   */
  getAppSetting(key: string): Promise<string | null>;

  /**
   * Create or update a single application setting.
   * @param key - The setting key
   * @param value - The setting value
   */
  setAppSetting(key: string, value: string): Promise<void>;

  /**
   * Create or update multiple application settings in sequence.
   * @param settings - An array of key-value pairs to set
   */
  setAppSettings(settings: { key: string; value: string }[]): Promise<void>;

  // Website marketing entries
  createWaitlistEntry(data: { email: string }): Promise<WaitlistEntry>;
  createNewsletterEntry(data: { email: string }): Promise<NewsletterEntry>;
  createContactMessage(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<ContactMessage>;
  createInstitutionalRequest(data: {
    name: string;
    institution: string;
    role: string;
    email: string;
    cohortSize?: string | null;
    message?: string | null;
  }): Promise<InstitutionalRequest>;
}

/** Database-backed implementation of {@link IStorage} using Drizzle ORM. */
export class DatabaseStorage implements IStorage {
  /** @inheritdoc */
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  /** @inheritdoc */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  /** @inheritdoc */
  async createUser(insertUser: InsertUser): Promise<User> {
    if (isMysql) {
      await db.insert(users).values(insertUser);
      const user = await this.getUserByEmail(insertUser.email);
      return user!;
    }
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  /** @inheritdoc */
  async getBooks(): Promise<Book[]> {
    return await db
      .select()
      .from(books)
      .where(eq(books.isPublished, true))
      .orderBy(books.order);
  }

  /** @inheritdoc */
  async getBook(id: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book || undefined;
  }

  /** @inheritdoc */
  async getChaptersByBook(bookId: string): Promise<Chapter[]> {
    return await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.bookId, bookId), eq(chapters.isPublished, true)))
      .orderBy(chapters.order);
  }

  /** @inheritdoc */
  async getChapter(id: string): Promise<Chapter | undefined> {
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, id));
    return chapter || undefined;
  }

  /** @inheritdoc */
  async getTopicsByChapter(chapterId: string): Promise<Topic[]> {
    return await db
      .select()
      .from(topics)
      .where(and(eq(topics.chapterId, chapterId), eq(topics.isPublished, true)))
      .orderBy(topics.order);
  }

  /** @inheritdoc */
  async getTopic(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic || undefined;
  }

  /** @inheritdoc */
  async getContentBlocksByTopic(topicId: string): Promise<ContentBlock[]> {
    return await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.topicId, topicId))
      .orderBy(contentBlocks.order);
  }

  /** @inheritdoc */
  async getMCQsByTopic(
    topicId: string,
    opts?: { year?: number; sourceId?: string },
  ): Promise<MCQ[]> {
    const conditions = [
      eq(mcqs.topicId, topicId),
      eq(mcqs.isPublished, true),
      eq(mcqs.isArchived, false),
    ];
    if (opts?.year) conditions.push(eq(mcqs.year, opts.year));
    if (opts?.sourceId) conditions.push(eq(mcqs.sourceId, opts.sourceId));
    return await db
      .select()
      .from(mcqs)
      .where(and(...conditions))
      .orderBy(mcqs.seq);
  }

  /** @inheritdoc */
  async getMCQs(
    limit = 10,
    difficulty?: string,
    opts?: { year?: number; sourceId?: string },
  ): Promise<MCQ[]> {
    const conditions = [eq(mcqs.isPublished, true), eq(mcqs.isArchived, false)];
    if (difficulty && difficulty !== "all")
      conditions.push(eq(mcqs.difficulty, difficulty));
    if (opts?.year) conditions.push(eq(mcqs.year, opts.year));
    if (opts?.sourceId) conditions.push(eq(mcqs.sourceId, opts.sourceId));
    return await db
      .select()
      .from(mcqs)
      .where(and(...conditions))
      .orderBy(isMysql ? sql`RAND()` : sql`RANDOM()`)
      .limit(limit);
  }

  /** @inheritdoc */
  async getMCQMetadataByIds(ids: string[]): Promise<
    Map<
      string,
      {
        year: number | null;
        sourceName: string | null;
        subjectName: string | null;
      }
    >
  > {
    const map = new Map<
      string,
      {
        year: number | null;
        sourceName: string | null;
        subjectName: string | null;
      }
    >();
    if (ids.length === 0) return map;
    const rows = await db
      .select({
        id: mcqs.id,
        year: mcqs.year,
        sourceName: sources.name,
        subjectName: subjects.title,
      })
      .from(mcqs)
      .leftJoin(sources, eq(mcqs.sourceId, sources.id))
      .leftJoin(topics, eq(mcqs.topicId, topics.id))
      .leftJoin(chapters, eq(topics.chapterId, chapters.id))
      .leftJoin(subjects, eq(chapters.subjectId, subjects.id))
      .where(inArray(mcqs.id, ids));
    for (const r of rows) {
      map.set(r.id, {
        year: r.year ?? null,
        sourceName: r.sourceName ?? null,
        subjectName: r.subjectName ?? null,
      });
    }
    return map;
  }

  /** @inheritdoc */
  async getQuizFilterOptions(): Promise<{
    years: number[];
    sources: { id: string; name: string }[];
  }> {
    const publishedActive = and(
      eq(mcqs.isPublished, true),
      eq(mcqs.isArchived, false),
    );
    const yearRows = await db
      .select({ year: mcqs.year })
      .from(mcqs)
      .where(and(publishedActive, sql`${mcqs.year} IS NOT NULL`))
      .groupBy(mcqs.year)
      .orderBy(desc(mcqs.year));
    const sourceRows = await db
      .select({ id: sources.id, name: sources.name })
      .from(mcqs)
      .innerJoin(sources, eq(mcqs.sourceId, sources.id))
      .where(publishedActive)
      .groupBy(sources.id, sources.name)
      .orderBy(sources.name);
    return {
      years: yearRows.map((r: { year: number | null }) => r.year as number),
      sources: sourceRows.map((r: { id: string; name: string }) => ({
        id: r.id,
        name: r.name,
      })),
    };
  }

  /** @inheritdoc */
  async recordMcqStats(results: Record<string, boolean>): Promise<void> {
    const entries = Object.entries(results);
    if (entries.length === 0) return;
    for (const [mcqId, isCorrect] of entries) {
      await db
        .insert(mcqStats)
        .values({ mcqId, attempts: 1, correct: isCorrect ? 1 : 0 })
        .onConflictDoUpdate({
          target: mcqStats.mcqId,
          set: {
            attempts: sql`${mcqStats.attempts} + 1`,
            correct: sql`${mcqStats.correct} + ${isCorrect ? 1 : 0}`,
            updatedAt: new Date(),
          },
        });
    }
  }

  /** @inheritdoc */
  async getMCQ(id: string): Promise<MCQ | undefined> {
    const [mcq] = await db.select().from(mcqs).where(eq(mcqs.id, id));
    return mcq || undefined;
  }

  /** @inheritdoc */
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId));
  }

  /** @inheritdoc */
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

  /** @inheritdoc */
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

  /**
   * Mark a topic as incomplete for a user. No-op if no progress record exists.
   * @param userId - The user's UUID
   * @param topicId - The topic's UUID
   */
  async markTopicUncomplete(userId: string, topicId: string): Promise<void> {
    const existing = await this.getTopicProgress(userId, topicId);
    if (existing) {
      await db
        .update(userProgress)
        .set({ isCompleted: false, completedAt: null })
        .where(eq(userProgress.id, existing.id));
    }
  }

  /** @inheritdoc */
  async getBookmarks(userId: string): Promise<Bookmark[]> {
    return await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  }

  /** @inheritdoc */
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

  /** @inheritdoc */
  async isBookmarked(userId: string, topicId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.topicId, topicId)));
    return !!existing;
  }

  /** @inheritdoc */
  async createQuizAttempt(
    attempt: Omit<QuizAttempt, "id" | "createdAt">,
  ): Promise<QuizAttempt> {
    const [result] = await db.insert(quizAttempts).values(attempt).returning();
    return result;
  }

  /** @inheritdoc */
  async getQuizAttempt(id: string): Promise<QuizAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, id));
    return attempt || undefined;
  }

  /** @inheritdoc */
  async getQuizAttempts(userId: string): Promise<QuizAttempt[]> {
    return await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.createdAt));
  }

  /** @inheritdoc */
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

  /** @inheritdoc */
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
      .where(
        and(
          eq(mcqs.isPublished, true),
          eq(mcqs.isArchived, false),
          inArray(mcqs.id, wrongIds),
        ),
      );
    return allMcqs;
  }

  /** @inheritdoc */
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

  /**
   * Store a 6-digit OTP for password reset (in the same table, using `token` column).
   * @param userId - The user's UUID
   * @param otp - The 6-digit OTP code to store
   */
  async createPasswordResetOtp(userId: string, otp: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
    await db.insert(passwordResetTokens).values({
      userId,
      token: otp,
      expiresAt,
    });
  }

  /** @inheritdoc */
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

  /**
   * Look up a password-reset OTP by the user's email and OTP code.
   * Validates that the OTP is unused and not expired.
   * @param email - The user's email address
   * @param otp - The 6-digit OTP code
   * @returns The token record, or undefined if invalid/expired/used or user not found
   */
  async getPasswordResetByOtp(
    email: string,
    otp: string,
  ): Promise<PasswordResetToken | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
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

  /** @inheritdoc */
  async markTokenUsed(tokenId: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  /** @inheritdoc */
  async updateUserPassword(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  /** @inheritdoc */
  async updateUserProfile(
    userId: string,
    data: { name: string; avatarUrl?: string | null },
  ): Promise<User | undefined> {
    const setData: { name: string; avatarUrl?: string | null } = {
      name: data.name,
    };
    if (data.avatarUrl !== undefined) {
      setData.avatarUrl = data.avatarUrl;
    }

    const [user] = await db
      .update(users)
      .set(setData)
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  /** @inheritdoc */
  async updateSubscription(
    userId: string,
    data: {
      subscriptionStatus: string;
      subscriptionPlan?: string;
      subscriptionExpiresAt?: Date | null;
    },
  ): Promise<User | undefined> {
    const setData: Record<string, any> = {
      subscriptionStatus: data.subscriptionStatus,
    };
    if (data.subscriptionPlan !== undefined)
      setData.subscriptionPlan = data.subscriptionPlan;
    if (data.subscriptionExpiresAt !== undefined)
      setData.subscriptionExpiresAt = data.subscriptionExpiresAt;

    const [user] = await db
      .update(users)
      .set(setData)
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  /** @inheritdoc */
  async deactivateUser(
    userId: string,
    reason?: string,
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: reason?.trim() || null,
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  /** @inheritdoc */
  async requestAccountDeletion(
    userId: string,
    _note?: string,
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        deletionRequestedAt: new Date(),
        deletionStatus: "requested",
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  /** @inheritdoc */
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

  /** @inheritdoc */
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

  /** @inheritdoc */
  async updateUserVerification(
    userId: string,
    data: {
      isEmailVerified?: boolean;
      emailVerificationToken?: string | null;
      emailTokenExpiresAt?: Date | null;
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

  /**
   * Get all published chapters with topic counts using LEFT JOIN + GROUP BY.
   * Eliminates N+1 queries when listing chapters across books.
   * @returns An array of chapter summaries grouped by book, including topic counts
   */
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

  /**
   * Get all published topics for a book (across all its chapters) in a single query.
   * @param bookId - The book's UUID
   * @returns An array of topics ordered by chapter order then topic order
   */
  async getTopicsByBook(bookId: string): Promise<Topic[]> {
    return await db
      .select({ topic: topics })
      .from(topics)
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .where(and(eq(chapters.bookId, bookId), eq(topics.isPublished, true)))
      .orderBy(chapters.order, topics.order)
      .then((rows: any) => rows.map((r: any) => r.topic));
  }

  /**
   * Get all published topic IDs grouped by their parent book ID in a single query.
   * Used to compute per-book completion counts without N+1 queries.
   * @returns An array of { bookId, topicId } pairs
   */
  async getAllTopicIdsGroupedByBook(): Promise<
    { bookId: string; topicId: string }[]
  > {
    return await db
      .select({
        bookId: chapters.bookId,
        topicId: topics.id,
      })
      .from(topics)
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .where(and(eq(topics.isPublished, true), eq(chapters.isPublished, true)));
  }

  /**
   * Full-text search across books, chapters, and topics using SQL ILIKE.
   * @param query - The search term to match against titles and descriptions
   * @param filter - Content type filter: "all", "books", "chapters", or "topics"
   * @param limit - Maximum number of results to return (default 50)
   * @returns An array of search result objects with type, title, and hierarchy info
   */
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
    const results: {
      id: string;
      type: "book" | "chapter" | "topic";
      title: string;
      subtitle: string;
      bookId?: string;
      bookTitle?: string;
      chapterId?: string;
      chapterTitle?: string;
    }[] = [];

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

  /**
   * Get all topics that have published MCQs, along with the question count per topic.
   * Uses a JOIN instead of N+1 queries.
   * @returns An array of topic objects with their chapter title and question count
   */
  async getQuizTopicsWithCounts(): Promise<
    {
      id: string;
      title: string;
      chapterTitle: string;
      isPaid: boolean;
      questionCount: number;
    }[]
  > {
    const rows = await db
      .select({
        topicId: topics.id,
        topicTitle: topics.title,
        chapterTitle: chapters.title,
        isPaid: topics.isPaid,
        questionCount: sql<number>`count(${mcqs.id})`.as("question_count"),
      })
      .from(topics)
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .innerJoin(mcqs, eq(mcqs.topicId, topics.id))
      .where(
        and(
          eq(topics.isPublished, true),
          eq(mcqs.isPublished, true),
          eq(mcqs.isArchived, false),
        ),
      )
      .groupBy(
        topics.id,
        topics.title,
        chapters.title,
        topics.isPaid,
        chapters.order,
        topics.order,
      )
      .having(sql`count(${mcqs.id}) > 0`)
      .orderBy(asc(chapters.order), asc(topics.order));

    return rows.map((r: any) => ({
      id: r.topicId,
      title: r.topicTitle,
      chapterTitle: r.chapterTitle,
      isPaid: Boolean(r.isPaid),
      questionCount: Number(r.questionCount),
    }));
  }

  /**
   * Get multiple MCQs by their IDs in a single query.
   * @param ids - An array of MCQ UUIDs to fetch
   * @returns An array of MCQ records. Returns an empty array if ids is empty.
   */
  async getMCQsByIds(ids: string[]): Promise<MCQ[]> {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(mcqs)
      .where(sql`${mcqs.id} IN ${ids}`);
  }

  /**
   * Get all bookmarks for a user with full topic → chapter → book details via JOINs.
   * @param userId - The user's UUID
   * @returns An array of enriched bookmark objects ordered by most recent first
   */
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

  /**
   * Get recent topic-view activity for a user with full topic → chapter → book details via JOINs.
   * @param userId - The user's UUID
   * @param limit - Maximum number of records to return (default 20)
   * @returns An array of enriched activity objects ordered by most recent first
   */
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

  /**
   * Get quiz attempts for a user with pagination support.
   * @param userId - The user's UUID
   * @param page - Page number (1-indexed, default 1)
   * @param pageSize - Number of records per page (default 20)
   * @returns A paginated result with data, total count, page, and pageSize
   */
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

  /**
   * Get MCQ review cards that are due for spaced repetition review.
   * @param userId - The user's UUID
   * @param limit - Maximum number of due reviews to return (default 20)
   * @returns An array of review schedule records ordered by next review date
   */
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

  /**
   * Get or create a spaced repetition review schedule entry for a user–MCQ pair.
   * If no entry exists, one is created with default SM-2 values.
   * @param userId - The user's UUID
   * @param mcqId - The MCQ's UUID
   * @returns The existing or newly created review schedule record
   */
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

  /**
   * Update a review schedule entry after answering, applying the SM-2 spaced repetition algorithm.
   * Quality ≥ 3 counts as correct (interval grows); quality < 3 resets repetitions.
   * @param reviewId - The review schedule record's UUID
   * @param quality - Quality rating from 0 to 5 (0 = complete blackout, 5 = perfect response)
   * @returns The updated review schedule record with new interval and next review date
   * @throws Error if the review record is not found
   */
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

  /**
   * Count the number of MCQ reviews currently due for a user.
   * @param userId - The user's UUID
   * @returns The count of due review cards
   */
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

  /**
   * Create a content error report submitted by a user.
   * @param data - The report details including user, content reference, type, and description
   * @returns The newly created content report record
   */
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

  /**
   * Get content error reports (for admin), enriched with user name and topic title.
   * @param status - Optional status filter (e.g. "pending", "resolved"). If omitted, all reports are returned.
   * @param limit - Maximum number of reports to return (default 50)
   * @returns An array of enriched content report objects ordered by most recent first
   */
  async getContentReports(status?: string, limit: number = 50) {
    const baseQuery = db
      .select({
        id: contentReports.id,
        userId: contentReports.userId,
        userName: users.name,
        contentType: contentReports.contentType,
        contentId: contentReports.contentId,
        topicTitle: topics.title,
        reportType: contentReports.reportType,
        description: contentReports.description,
        status: contentReports.status,
        reviewedBy: contentReports.reviewedBy,
        reviewedAt: contentReports.reviewedAt,
        createdAt: contentReports.createdAt,
      })
      .from(contentReports)
      .leftJoin(users, eq(contentReports.userId, users.id))
      .leftJoin(topics, eq(contentReports.contentId, topics.id))
      .orderBy(desc(contentReports.createdAt))
      .limit(limit);

    if (status) {
      return await db
        .select({
          id: contentReports.id,
          userId: contentReports.userId,
          userName: users.name,
          contentType: contentReports.contentType,
          contentId: contentReports.contentId,
          topicTitle: topics.title,
          reportType: contentReports.reportType,
          description: contentReports.description,
          status: contentReports.status,
          reviewedBy: contentReports.reviewedBy,
          reviewedAt: contentReports.reviewedAt,
          createdAt: contentReports.createdAt,
        })
        .from(contentReports)
        .leftJoin(users, eq(contentReports.userId, users.id))
        .leftJoin(topics, eq(contentReports.contentId, topics.id))
        .where(eq(contentReports.status, status))
        .orderBy(desc(contentReports.createdAt))
        .limit(limit);
    }
    return await baseQuery;
  }

  /**
   * Update the status of a content error report (admin action).
   * @param reportId - The report's UUID
   * @param status - The new status (e.g. "resolved", "dismissed")
   * @param reviewedBy - The admin user's UUID who reviewed the report
   * @returns The updated content report record, or undefined if not found
   */
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

  /** @inheritdoc */
  async getRecommendedTopics(
    userId: string,
    limit: number = 5,
  ): Promise<
    {
      id: string;
      title: string;
      chapterTitle: string;
      bookTitle: string;
      isPaid: boolean;
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
        isPaid: topics.isPaid,
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
      .orderBy(isMysql ? sql`RAND()` : sql`RANDOM()`)
      .limit(limit);

    return result.map((r: any) => ({
      id: r.id,
      title: r.title,
      chapterTitle: r.chapterTitle,
      bookTitle: r.bookTitle,
      isPaid: Boolean(r.isPaid),
      progress: 0,
    }));
  }

  /** @inheritdoc */
  async getAnnouncements(userId?: string): Promise<
    {
      id: string;
      title: string;
      message: string;
      type: string;
      createdAt: string;
      isRead: boolean;
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
          userId
            ? sql`(${announcements.userId} IS NULL OR ${announcements.userId} = ${userId})`
            : sql`${announcements.userId} IS NULL`,
        ),
      )
      .orderBy(desc(announcements.createdAt));
    return rows.map((r: any) => ({
      id: String(r.id),
      title: r.title,
      message: r.message,
      type: r.type,
      createdAt: r.createdAt.toISOString(),
      isRead: false,
    }));
  }

  // ── App Settings ──────────────────────────

  /** @inheritdoc */
  async getAppSettings(keys?: string[]): Promise<AppSetting[]> {
    if (keys && keys.length > 0) {
      return db
        .select()
        .from(appSettings)
        .where(inArray(appSettings.key, keys));
    }
    return db.select().from(appSettings);
  }

  /** @inheritdoc */
  async getAppSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key));
    return setting?.value ?? null;
  }

  /** @inheritdoc */
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

  /** @inheritdoc */
  async setAppSettings(
    settings: { key: string; value: string }[],
  ): Promise<void> {
    for (const { key, value } of settings) {
      await this.setAppSetting(key, value);
    }
  }

  async createWaitlistEntry(data: { email: string }): Promise<WaitlistEntry> {
    const [entry] = await db.insert(waitlistEntries).values(data).returning();
    return entry;
  }

  async createNewsletterEntry(data: {
    email: string;
  }): Promise<NewsletterEntry> {
    const [entry] = await db.insert(newsletterEntries).values(data).returning();
    return entry;
  }

  async createContactMessage(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<ContactMessage> {
    const [msg] = await db.insert(contactMessages).values(data).returning();
    return msg;
  }

  async createInstitutionalRequest(data: {
    name: string;
    institution: string;
    role: string;
    email: string;
    cohortSize?: string | null;
    message?: string | null;
  }): Promise<InstitutionalRequest> {
    const [req] = await db
      .insert(institutionalRequests)
      .values(data)
      .returning();
    return req;
  }
}

export const storage = new DatabaseStorage();
