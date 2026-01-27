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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, avg } from "drizzle-orm";

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
  getTopicProgress(userId: string, topicId: string): Promise<UserProgress | undefined>;
  markTopicComplete(userId: string, topicId: string): Promise<void>;
  
  getBookmarks(userId: string): Promise<Bookmark[]>;
  toggleBookmark(userId: string, topicId: string): Promise<boolean>;
  isBookmarked(userId: string, topicId: string): Promise<boolean>;
  
  createQuizAttempt(attempt: Omit<QuizAttempt, "id" | "createdAt">): Promise<QuizAttempt>;
  getQuizAttempt(id: string): Promise<QuizAttempt | undefined>;
  getQuizAttempts(userId: string): Promise<QuizAttempt[]>;
  getQuizStats(userId: string): Promise<{ totalAttempts: number; averageScore: number; wrongQuestionsCount: number }>;
  getWrongQuestions(userId: string): Promise<MCQ[]>;
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
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
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
      query = db.select().from(mcqs).where(and(eq(mcqs.isPublished, true), eq(mcqs.difficulty, difficulty)));
    }
    return await query.limit(limit).orderBy(sql`RANDOM()`);
  }

  async getMCQ(id: string): Promise<MCQ | undefined> {
    const [mcq] = await db.select().from(mcqs).where(eq(mcqs.id, id));
    return mcq || undefined;
  }

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return await db.select().from(userProgress).where(eq(userProgress.userId, userId));
  }

  async getTopicProgress(userId: string, topicId: string): Promise<UserProgress | undefined> {
    const [progress] = await db
      .select()
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.topicId, topicId)));
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

  async createQuizAttempt(attempt: Omit<QuizAttempt, "id" | "createdAt">): Promise<QuizAttempt> {
    const [result] = await db.insert(quizAttempts).values(attempt).returning();
    return result;
  }

  async getQuizAttempt(id: string): Promise<QuizAttempt | undefined> {
    const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, id));
    return attempt || undefined;
  }

  async getQuizAttempts(userId: string): Promise<QuizAttempt[]> {
    return await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.createdAt));
  }

  async getQuizStats(userId: string): Promise<{ totalAttempts: number; averageScore: number; wrongQuestionsCount: number }> {
    const attempts = await this.getQuizAttempts(userId);
    const totalAttempts = attempts.length;
    const averageScore = totalAttempts > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts)
      : 0;
    
    let wrongQuestionsCount = 0;
    for (const attempt of attempts) {
      wrongQuestionsCount += attempt.wrongCount;
    }

    return { totalAttempts, averageScore, wrongQuestionsCount };
  }

  async getWrongQuestions(userId: string): Promise<MCQ[]> {
    const attempts = await this.getQuizAttempts(userId);
    const wrongIds = new Set<string>();

    for (const attempt of attempts) {
      const answers = attempt.answers as Record<string, { selected: string; correct: string; isCorrect: boolean }>;
      for (const [mcqId, answer] of Object.entries(answers)) {
        if (!answer.isCorrect) {
          wrongIds.add(mcqId);
        }
      }
    }

    if (wrongIds.size === 0) return [];

    const allMcqs = await db.select().from(mcqs).where(eq(mcqs.isPublished, true));
    return allMcqs.filter(m => wrongIds.has(m.id));
  }
}

export const storage = new DatabaseStorage();
