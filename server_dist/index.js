var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes/index.ts
import { createServer } from "node:http";

// server/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";
import { Resend } from "resend";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bookmarks: () => bookmarks,
  bookmarksRelations: () => bookmarksRelations,
  books: () => books,
  booksRelations: () => booksRelations,
  chapters: () => chapters,
  chaptersRelations: () => chaptersRelations,
  contentBlocks: () => contentBlocks,
  contentBlocksRelations: () => contentBlocksRelations,
  forgotPasswordSchema: () => forgotPasswordSchema,
  insertUserSchema: () => insertUserSchema,
  loginSchema: () => loginSchema,
  mcqs: () => mcqs,
  mcqsRelations: () => mcqsRelations,
  passwordResetTokens: () => passwordResetTokens,
  passwordResetTokensRelations: () => passwordResetTokensRelations,
  quizAttempts: () => quizAttempts,
  quizAttemptsRelations: () => quizAttemptsRelations,
  recentActivity: () => recentActivity,
  recentActivityRelations: () => recentActivityRelations,
  registerSchema: () => registerSchema,
  resetPasswordSchema: () => resetPasswordSchema,
  topics: () => topics,
  topicsRelations: () => topicsRelations,
  userProgress: () => userProgress,
  userProgressRelations: () => userProgressRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("student"),
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  subscriptionPlan: text("subscription_plan"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  bookmarks: many(bookmarks),
  quizAttempts: many(quizAttempts)
}));
var books = pgTable("books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  isPublished: boolean("is_published").default(false),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var booksRelations = relations(books, ({ many }) => ({
  chapters: many(chapters)
}));
var chapters = pgTable("chapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  order: integer("order").default(0),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var chaptersRelations = relations(chapters, ({ one, many }) => ({
  book: one(books, {
    fields: [chapters.bookId],
    references: [books.id]
  }),
  topics: many(topics)
}));
var topics = pgTable("topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  order: integer("order").default(0),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var topicsRelations = relations(topics, ({ one, many }) => ({
  chapter: one(chapters, {
    fields: [topics.chapterId],
    references: [chapters.id]
  }),
  contentBlocks: many(contentBlocks),
  mcqs: many(mcqs)
}));
var contentBlocks = pgTable("content_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content").notNull(),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var contentBlocksRelations = relations(contentBlocks, ({ one }) => ({
  topic: one(topics, {
    fields: [contentBlocks.topicId],
    references: [topics.id]
  })
}));
var mcqs = pgTable("mcqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation"),
  difficulty: text("difficulty").notNull().default("medium"),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var mcqsRelations = relations(mcqs, ({ one }) => ({
  topic: one(topics, {
    fields: [mcqs.topicId],
    references: [topics.id]
  })
}));
var userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id]
  }),
  topic: one(topics, {
    fields: [userProgress.topicId],
    references: [topics.id]
  })
}));
var bookmarks = pgTable("bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id]
  }),
  topic: one(topics, {
    fields: [bookmarks.topicId],
    references: [topics.id]
  })
}));
var quizAttempts = pgTable("quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id").references(() => topics.id, {
    onDelete: "set null"
  }),
  mode: text("mode").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  correctCount: integer("correct_count").notNull(),
  wrongCount: integer("wrong_count").notNull(),
  timeTaken: integer("time_taken"),
  answers: jsonb("answers").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id]
  }),
  topic: one(topics, {
    fields: [quizAttempts.topicId],
    references: [topics.id]
  })
}));
var passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id]
    })
  })
);
var recentActivity = pgTable("recent_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull()
});
var recentActivityRelations = relations(recentActivity, ({ one }) => ({
  user: one(users, {
    fields: [recentActivity.userId],
    references: [users.id]
  }),
  topic: one(topics, {
    fields: [recentActivity.topicId],
    references: [topics.id]
  })
}));
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true
});
var loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
var registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6)
});
var forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email")
});
var resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, and, desc, sql as sql2, gt } from "drizzle-orm";
import crypto from "crypto";
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getBooks() {
    return await db.select().from(books).where(eq(books.isPublished, true)).orderBy(books.order);
  }
  async getBook(id) {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book || void 0;
  }
  async getChaptersByBook(bookId) {
    return await db.select().from(chapters).where(and(eq(chapters.bookId, bookId), eq(chapters.isPublished, true))).orderBy(chapters.order);
  }
  async getChapter(id) {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    return chapter || void 0;
  }
  async getTopicsByChapter(chapterId) {
    return await db.select().from(topics).where(and(eq(topics.chapterId, chapterId), eq(topics.isPublished, true))).orderBy(topics.order);
  }
  async getTopic(id) {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic || void 0;
  }
  async getContentBlocksByTopic(topicId) {
    return await db.select().from(contentBlocks).where(eq(contentBlocks.topicId, topicId)).orderBy(contentBlocks.order);
  }
  async getMCQsByTopic(topicId) {
    return await db.select().from(mcqs).where(and(eq(mcqs.topicId, topicId), eq(mcqs.isPublished, true)));
  }
  async getMCQs(limit = 10, difficulty) {
    let query = db.select().from(mcqs).where(eq(mcqs.isPublished, true));
    if (difficulty && difficulty !== "all") {
      query = db.select().from(mcqs).where(
        and(eq(mcqs.isPublished, true), eq(mcqs.difficulty, difficulty))
      );
    }
    return await query.limit(limit).orderBy(sql2`RANDOM()`);
  }
  async getMCQ(id) {
    const [mcq] = await db.select().from(mcqs).where(eq(mcqs.id, id));
    return mcq || void 0;
  }
  async getUserProgress(userId) {
    return await db.select().from(userProgress).where(eq(userProgress.userId, userId));
  }
  async getTopicProgress(userId, topicId) {
    const [progress] = await db.select().from(userProgress).where(
      and(eq(userProgress.userId, userId), eq(userProgress.topicId, topicId))
    );
    return progress || void 0;
  }
  async markTopicComplete(userId, topicId) {
    const existing = await this.getTopicProgress(userId, topicId);
    if (existing) {
      await db.update(userProgress).set({ isCompleted: true, completedAt: /* @__PURE__ */ new Date() }).where(eq(userProgress.id, existing.id));
    } else {
      await db.insert(userProgress).values({
        userId,
        topicId,
        isCompleted: true,
        completedAt: /* @__PURE__ */ new Date()
      });
    }
  }
  async getBookmarks(userId) {
    return await db.select().from(bookmarks).where(eq(bookmarks.userId, userId)).orderBy(desc(bookmarks.createdAt));
  }
  async toggleBookmark(userId, topicId) {
    const [existing] = await db.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.topicId, topicId)));
    if (existing) {
      await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
      return false;
    } else {
      await db.insert(bookmarks).values({ userId, topicId });
      return true;
    }
  }
  async isBookmarked(userId, topicId) {
    const [existing] = await db.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.topicId, topicId)));
    return !!existing;
  }
  async createQuizAttempt(attempt) {
    const [result] = await db.insert(quizAttempts).values(attempt).returning();
    return result;
  }
  async getQuizAttempt(id) {
    const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, id));
    return attempt || void 0;
  }
  async getQuizAttempts(userId) {
    return await db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.createdAt));
  }
  async getQuizStats(userId) {
    const attempts = await this.getQuizAttempts(userId);
    const totalAttempts = attempts.length;
    const averageScore = totalAttempts > 0 ? Math.round(
      attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts
    ) : 0;
    let wrongQuestionsCount = 0;
    for (const attempt of attempts) {
      wrongQuestionsCount += attempt.wrongCount;
    }
    return { totalAttempts, averageScore, wrongQuestionsCount };
  }
  async getWrongQuestions(userId) {
    const attempts = await this.getQuizAttempts(userId);
    const sortedAttempts = [...attempts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const questionStatus = /* @__PURE__ */ new Map();
    for (const attempt of sortedAttempts) {
      const answers = attempt.answers;
      for (const [mcqId, answer] of Object.entries(answers)) {
        questionStatus.set(mcqId, answer.isCorrect);
      }
    }
    const wrongIds = [];
    for (const [mcqId, isCorrect] of questionStatus.entries()) {
      if (!isCorrect) {
        wrongIds.push(mcqId);
      }
    }
    if (wrongIds.length === 0) return [];
    const allMcqs = await db.select().from(mcqs).where(eq(mcqs.isPublished, true));
    return allMcqs.filter((m) => wrongIds.includes(m.id));
  }
  async createPasswordResetToken(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1e3);
    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt
    });
    return token;
  }
  async getPasswordResetToken(token) {
    const [resetToken] = await db.select().from(passwordResetTokens).where(
      and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false),
        gt(passwordResetTokens.expiresAt, /* @__PURE__ */ new Date())
      )
    );
    return resetToken || void 0;
  }
  async markTokenUsed(tokenId) {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, tokenId));
  }
  async updateUserPassword(userId, hashedPassword) {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }
  async updateUserProfile(userId, data) {
    const [user] = await db.update(users).set({ name: data.name }).where(eq(users.id, userId)).returning();
    return user || void 0;
  }
  async recordTopicView(userId, topicId) {
    const [existing] = await db.select().from(recentActivity).where(
      and(
        eq(recentActivity.userId, userId),
        eq(recentActivity.topicId, topicId)
      )
    );
    if (existing) {
      await db.update(recentActivity).set({ viewedAt: /* @__PURE__ */ new Date() }).where(eq(recentActivity.id, existing.id));
    } else {
      await db.insert(recentActivity).values({ userId, topicId });
    }
  }
  async getRecentActivity(userId, limit = 20) {
    return await db.select().from(recentActivity).where(eq(recentActivity.userId, userId)).orderBy(desc(recentActivity.viewedAt)).limit(limit);
  }
};
var storage = new DatabaseStorage();

// server/routes/auth.ts
import { z as z2 } from "zod";

// server/middleware.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.SESSION_SECRET || "maternal-mind-secret-key";
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid token" });
  }
  req.userId = decoded.userId;
  next();
}

// server/routes/auth.ts
var router = Router();
var resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
var JWT_SECRET2 = process.env.SESSION_SECRET || "maternal-mind-secret-key";
var JWT_EXPIRES_IN = "7d";
function generateToken(userId) {
  return jwt2.sign({ userId }, JWT_SECRET2, { expiresIn: JWT_EXPIRES_IN });
}
router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await storage.createUser({
      email: data.email,
      password: hashedPassword,
      name: data.name
    });
    const accessToken = generateToken(user.id);
    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan
      }
    });
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Register error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});
router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await storage.getUserByEmail(data.email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const accessToken = generateToken(user.id);
    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan
      }
    });
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});
router.post("/forgot-password", async (req, res) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    const user = await storage.getUserByEmail(data.email);
    if (!user) {
      return res.json({
        message: "If an account exists with this email, a reset link has been sent."
      });
    }
    const token = await storage.createPasswordResetToken(user.id);
    const appDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
    const resetLink = `https://${appDomain}/reset-password?token=${token}`;
    if (resend) {
      try {
        await resend.emails.send({
          from: "Maternal Mind <noreply@maternalmind.app>",
          to: user.email,
          subject: "Reset Your Password - Maternal Mind",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #11a4d4;">Reset Your Password</h1>
              <p>Hello ${user.name},</p>
              <p>You requested to reset your password for Maternal Mind. Click the button below to set a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background: #11a4d4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
              </div>
              <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">Maternal Mind - OB-GYN Education Platform</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
      }
    } else {
      console.log(`[DEV] Password reset link for ${user.email}: ${resetLink}`);
    }
    res.json({
      message: "If an account exists with this email, a reset link has been sent."
    });
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to process request" });
  }
});
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.json({
        message: "If an account exists with this email, a verification link has been sent."
      });
    }
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend: Resend2 } = await import("resend");
        const resend2 = new Resend2(process.env.RESEND_API_KEY);
        await resend2.emails.send({
          from: "Maternal Mind <noreply@maternalmind.app>",
          to: [email],
          subject: "Verify your email - Maternal Mind",
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #11a4d4; margin-bottom: 20px;">Verify Your Email</h1>
              <p style="color: #333; font-size: 16px; line-height: 24px;">
                Thank you for signing up for Maternal Mind! Please verify your email to access all features.
              </p>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you didn't create an account, please ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">Maternal Mind - OB-GYN Education Platform</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
      }
    } else {
      console.log(`[DEV] Verification email would be sent to ${email}`);
    }
    res.json({
      message: "If an account exists with this email, a verification link has been sent."
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Failed to send verification email" });
  }
});
router.post("/reset-password", async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const resetToken = await storage.getPasswordResetToken(data.token);
    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    await storage.updateUserPassword(resetToken.userId, hashedPassword);
    await storage.markTokenUsed(resetToken.id);
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await storage.getUser(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
});
router.post("/logout", authMiddleware, async (_req, res) => {
  res.json({ success: true });
});
router.post(
  "/change-password",
  authMiddleware,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(req.userId, hashedNewPassword);
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  }
);
router.post("/logout-all", authMiddleware, async (req, res) => {
  try {
    res.json({ message: "Logged out of all devices" });
  } catch (error) {
    console.error("Logout all error:", error);
    res.status(500).json({ message: "Failed to logout all devices" });
  }
});
var auth_default = router;

// server/routes/user.ts
import { Router as Router2 } from "express";
var router2 = Router2();
router2.patch("/profile", authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }
    const updatedUser = await storage.updateUserProfile(req.userId, {
      name: name.trim()
    });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      subscriptionStatus: updatedUser.subscriptionStatus,
      subscriptionPlan: updatedUser.subscriptionPlan
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});
router2.post(
  "/support/report-issue",
  authMiddleware,
  async (req, res) => {
    try {
      const { type, description, email } = req.body;
      if (!type || !description) {
        return res.status(400).json({ message: "Issue type and description are required" });
      }
      console.log(`[SUPPORT] Issue reported by ${email}:`);
      console.log(`  Type: ${type}`);
      console.log(`  Description: ${description}`);
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend: Resend2 } = await import("resend");
          const resendClient = new Resend2(process.env.RESEND_API_KEY);
          await resendClient.emails.send({
            from: "Maternal Mind <noreply@maternalmind.app>",
            to: ["support@maternalmind.app"],
            subject: `[${type.toUpperCase()}] New Issue Report`,
            html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #11a4d4;">Issue Report</h1>
              <p><strong>Type:</strong> ${type}</p>
              <p><strong>User:</strong> ${email}</p>
              <p><strong>Description:</strong></p>
              <p style="background: #f5f5f5; padding: 15px; border-radius: 8px;">${description}</p>
            </div>
          `
          });
        } catch (emailError) {
          console.error("Failed to send support email:", emailError);
        }
      }
      res.json({ message: "Issue reported successfully" });
    } catch (error) {
      console.error("Report issue error:", error);
      res.status(500).json({ message: "Failed to report issue" });
    }
  }
);
router2.get(
  "/recent-activity",
  authMiddleware,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const recentActivities = await storage.getRecentActivity(
        req.userId,
        limit
      );
      const activitiesWithDetails = await Promise.all(
        recentActivities.map(async (activity) => {
          const topic = await storage.getTopic(activity.topicId);
          if (!topic) return null;
          const chapter = await storage.getChapter(topic.chapterId);
          if (!chapter) return null;
          const book = await storage.getBook(chapter.bookId);
          if (!book) return null;
          return {
            id: activity.id,
            topicId: topic.id,
            topicTitle: topic.title,
            chapterTitle: chapter.title,
            bookTitle: book.title,
            viewedAt: activity.viewedAt.toISOString()
          };
        })
      );
      res.json(activitiesWithDetails.filter(Boolean));
    } catch (error) {
      console.error("Get recent activity error:", error);
      res.status(500).json({ message: "Failed to get recent activity" });
    }
  }
);
router2.get("/bookmarks", authMiddleware, async (req, res) => {
  try {
    const userBookmarks = await storage.getBookmarks(req.userId);
    const bookmarksWithDetails = await Promise.all(
      userBookmarks.map(async (bookmark) => {
        const topic = await storage.getTopic(bookmark.topicId);
        if (!topic) return null;
        const chapter = await storage.getChapter(topic.chapterId);
        if (!chapter) return null;
        const book = await storage.getBook(chapter.bookId);
        if (!book) return null;
        return {
          id: bookmark.id,
          topicId: topic.id,
          topicTitle: topic.title,
          chapterTitle: chapter.title,
          bookTitle: book.title,
          createdAt: bookmark.createdAt.toISOString()
        };
      })
    );
    res.json(bookmarksWithDetails.filter(Boolean));
  } catch (error) {
    console.error("Get bookmarks error:", error);
    res.status(500).json({ message: "Failed to get bookmarks" });
  }
});
var user_default = router2;

// server/routes/content.ts
import { Router as Router3 } from "express";
var router3 = Router3();
router3.get("/books", authMiddleware, async (req, res) => {
  try {
    const booksData = await storage.getBooks();
    const userProgressData = await storage.getUserProgress(req.userId);
    const booksWithProgress = await Promise.all(
      booksData.map(async (book) => {
        const chaptersData = await storage.getChaptersByBook(book.id);
        let totalTopics = 0;
        let completedTopics = 0;
        for (const chapter of chaptersData) {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
          totalTopics += topicsData.length;
          completedTopics += topicsData.filter(
            (t) => userProgressData.some((p) => p.topicId === t.id && p.isCompleted)
          ).length;
        }
        return {
          id: book.id,
          title: book.title,
          description: book.description,
          imageUrl: book.imageUrl,
          chaptersCount: chaptersData.length,
          progress: totalTopics > 0 ? Math.round(completedTopics / totalTopics * 100) : 0
        };
      })
    );
    res.json(booksWithProgress);
  } catch (error) {
    console.error("Get books error:", error);
    res.status(500).json({ message: "Failed to get books" });
  }
});
router3.get(
  "/books/:bookId/chapters",
  authMiddleware,
  async (req, res) => {
    try {
      const { bookId } = req.params;
      const chaptersData = await storage.getChaptersByBook(bookId);
      const userProgressData = await storage.getUserProgress(req.userId);
      const chaptersWithProgress = await Promise.all(
        chaptersData.map(async (chapter) => {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
          const completedTopics = topicsData.filter(
            (t) => userProgressData.some((p) => p.topicId === t.id && p.isCompleted)
          ).length;
          return {
            id: chapter.id,
            title: chapter.title,
            description: chapter.description,
            topicsCount: topicsData.length,
            progress: topicsData.length > 0 ? Math.round(completedTopics / topicsData.length * 100) : 0,
            order: chapter.order
          };
        })
      );
      res.json(chaptersWithProgress);
    } catch (error) {
      console.error("Get chapters error:", error);
      res.status(500).json({ message: "Failed to get chapters" });
    }
  }
);
router3.get(
  "/chapters/:chapterId/topics",
  authMiddleware,
  async (req, res) => {
    try {
      const { chapterId } = req.params;
      const topicsData = await storage.getTopicsByChapter(chapterId);
      const userProgressData = await storage.getUserProgress(req.userId);
      const userBookmarks = await storage.getBookmarks(req.userId);
      const topicsWithStatus = topicsData.map((topic) => ({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        order: topic.order,
        isCompleted: userProgressData.some(
          (p) => p.topicId === topic.id && p.isCompleted
        ),
        isBookmarked: userBookmarks.some((b) => b.topicId === topic.id)
      }));
      res.json(topicsWithStatus);
    } catch (error) {
      console.error("Get topics error:", error);
      res.status(500).json({ message: "Failed to get topics" });
    }
  }
);
router3.get(
  "/topics/:topicId",
  authMiddleware,
  async (req, res) => {
    try {
      const { topicId } = req.params;
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      await storage.recordTopicView(req.userId, topicId);
      const blocks = await storage.getContentBlocksByTopic(topicId);
      const progress = await storage.getTopicProgress(req.userId, topicId);
      const isBookmarked = await storage.isBookmarked(req.userId, topicId);
      const allTopics = await storage.getTopicsByChapter(topic.chapterId);
      const currentIndex = allTopics.findIndex((t) => t.id === topicId);
      const previousTopicId = currentIndex > 0 ? allTopics[currentIndex - 1].id : void 0;
      const nextTopicId = currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1].id : void 0;
      res.json({
        id: topic.id,
        title: topic.title,
        isCompleted: progress?.isCompleted || false,
        isBookmarked,
        blocks: blocks.map((b) => ({
          id: b.id,
          type: b.type,
          content: b.content,
          order: b.order
        })),
        previousTopicId,
        nextTopicId
      });
    } catch (error) {
      console.error("Get topic error:", error);
      res.status(500).json({ message: "Failed to get topic" });
    }
  }
);
router3.post(
  "/topics/:topicId/complete",
  authMiddleware,
  async (req, res) => {
    try {
      const { topicId } = req.params;
      await storage.markTopicComplete(req.userId, topicId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark complete error:", error);
      res.status(500).json({ message: "Failed to mark topic complete" });
    }
  }
);
router3.post(
  "/topics/:topicId/bookmark",
  authMiddleware,
  async (req, res) => {
    try {
      const { topicId } = req.params;
      const isBookmarked = await storage.toggleBookmark(req.userId, topicId);
      res.json({ isBookmarked });
    } catch (error) {
      console.error("Toggle bookmark error:", error);
      res.status(500).json({ message: "Failed to toggle bookmark" });
    }
  }
);
router3.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = (req.query.query || "").toLowerCase().trim();
    const filter = req.query.filter || "all";
    if (query.length < 2) {
      return res.json([]);
    }
    const results = [];
    const booksData = await storage.getBooks();
    for (const book of booksData) {
      if (filter === "all" || filter === "books") {
        if (book.title.toLowerCase().includes(query) || book.description && book.description.toLowerCase().includes(query)) {
          results.push({
            id: book.id,
            type: "book",
            title: book.title,
            subtitle: book.description || "Book"
          });
        }
      }
      const chaptersData = await storage.getChaptersByBook(book.id);
      for (const chapter of chaptersData) {
        if (filter === "all" || filter === "chapters") {
          if (chapter.title.toLowerCase().includes(query) || chapter.description && chapter.description.toLowerCase().includes(query)) {
            results.push({
              id: chapter.id,
              type: "chapter",
              title: chapter.title,
              subtitle: book.title,
              bookId: book.id,
              bookTitle: book.title
            });
          }
        }
        if (filter === "all" || filter === "topics") {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
          for (const topic of topicsData) {
            if (topic.title.toLowerCase().includes(query) || topic.description && topic.description.toLowerCase().includes(query)) {
              results.push({
                id: topic.id,
                type: "topic",
                title: topic.title,
                subtitle: `${book.title} > ${chapter.title}`,
                bookId: book.id,
                bookTitle: book.title,
                chapterId: chapter.id,
                chapterTitle: chapter.title
              });
            }
          }
        }
      }
    }
    res.json(results.slice(0, 50));
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Search failed" });
  }
});
var content_default = router3;

// server/routes/quiz.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.get("/stats", authMiddleware, async (req, res) => {
  try {
    const stats = await storage.getQuizStats(req.userId);
    res.json(stats);
  } catch (error) {
    console.error("Get quiz stats error:", error);
    res.status(500).json({ message: "Failed to get quiz stats" });
  }
});
router4.get("/topics", authMiddleware, async (req, res) => {
  try {
    const booksData = await storage.getBooks();
    const quizTopics = [];
    for (const book of booksData) {
      const chaptersData = await storage.getChaptersByBook(book.id);
      for (const chapter of chaptersData) {
        const topicsData = await storage.getTopicsByChapter(chapter.id);
        for (const topic of topicsData) {
          const mcqsData = await storage.getMCQsByTopic(topic.id);
          if (mcqsData.length > 0) {
            quizTopics.push({
              id: topic.id,
              title: topic.title,
              chapterTitle: chapter.title,
              questionCount: mcqsData.length
            });
          }
        }
      }
    }
    res.json(quizTopics);
  } catch (error) {
    console.error("Get quiz topics error:", error);
    res.status(500).json({ message: "Failed to get quiz topics" });
  }
});
router4.get("/start/:mode", authMiddleware, async (req, res) => {
  try {
    const { mode } = req.params;
    const topicId = req.query.topicId;
    let questions = [];
    if (mode === "topic" && topicId) {
      questions = await storage.getMCQsByTopic(topicId);
    } else if (mode === "wrong") {
      questions = await storage.getWrongQuestions(req.userId);
    } else {
      questions = await storage.getMCQs(10);
    }
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5).slice(0, 10).map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      difficulty: q.difficulty
    }));
    res.json({
      quizId: `quiz-${Date.now()}`,
      questions: shuffledQuestions,
      timeLimit: 10
    });
  } catch (error) {
    console.error("Start quiz error:", error);
    res.status(500).json({ message: "Failed to start quiz" });
  }
});
router4.post("/submit", authMiddleware, async (req, res) => {
  try {
    const { quizId, answers, mode, topicId } = req.body;
    const answerEntries = Object.entries(answers);
    let correctCount = 0;
    const detailedAnswers = {};
    for (const [mcqId, selectedAnswer] of answerEntries) {
      const mcq = await storage.getMCQ(mcqId);
      if (mcq) {
        const isCorrect = selectedAnswer === mcq.correctAnswer;
        if (isCorrect) correctCount++;
        detailedAnswers[mcqId] = {
          selected: selectedAnswer,
          correct: mcq.correctAnswer,
          isCorrect,
          explanation: mcq.explanation
        };
      }
    }
    const totalQuestions = answerEntries.length;
    const wrongCount = totalQuestions - correctCount;
    const score = totalQuestions > 0 ? Math.round(correctCount / totalQuestions * 100) : 0;
    const attempt = await storage.createQuizAttempt({
      userId: req.userId,
      topicId: topicId || null,
      mode: mode || "mixed",
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      timeTaken: 0,
      answers: detailedAnswers
    });
    res.json({ id: attempt.id });
  } catch (error) {
    console.error("Submit quiz error:", error);
    res.status(500).json({ message: "Failed to submit quiz" });
  }
});
router4.get(
  "/results/:resultId",
  authMiddleware,
  async (req, res) => {
    try {
      const { resultId } = req.params;
      const attempt = await storage.getQuizAttempt(resultId);
      if (!attempt) {
        return res.status(404).json({ message: "Result not found" });
      }
      const answers = attempt.answers;
      const questions = await Promise.all(
        Object.entries(answers).map(async ([mcqId, answer]) => {
          const mcq = await storage.getMCQ(mcqId);
          return {
            id: mcqId,
            question: mcq?.question || "Question not found",
            selectedAnswer: answer.selected,
            correctAnswer: answer.correct,
            isCorrect: answer.isCorrect,
            explanation: answer.explanation || mcq?.explanation || ""
          };
        })
      );
      res.json({
        id: attempt.id,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        timeTaken: attempt.timeTaken || 0,
        questions
      });
    } catch (error) {
      console.error("Get quiz results error:", error);
      res.status(500).json({ message: "Failed to get quiz results" });
    }
  }
);
var quiz_default = router4;

// server/routes/progress.ts
import { Router as Router5 } from "express";
var router5 = Router5();
router5.get("/", authMiddleware, async (req, res) => {
  try {
    const stats = await storage.getQuizStats(req.userId);
    const attempts = await storage.getQuizAttempts(req.userId);
    const userProgressData = await storage.getUserProgress(req.userId);
    const booksData = await storage.getBooks();
    let totalTopics = 0;
    let topicsCompleted = 0;
    const topicProgressMap = /* @__PURE__ */ new Map();
    for (const book of booksData) {
      const chaptersData = await storage.getChaptersByBook(book.id);
      for (const chapter of chaptersData) {
        const topicsData = await storage.getTopicsByChapter(chapter.id);
        totalTopics += topicsData.length;
        for (const topic of topicsData) {
          if (userProgressData.some(
            (p) => p.topicId === topic.id && p.isCompleted
          )) {
            topicsCompleted++;
          }
          const topicAttempts = attempts.filter((a) => a.topicId === topic.id);
          if (topicAttempts.length > 0) {
            const avgScore = Math.round(
              topicAttempts.reduce((sum, a) => sum + a.score, 0) / topicAttempts.length
            );
            topicProgressMap.set(topic.id, {
              title: topic.title,
              accuracy: avgScore,
              attempts: topicAttempts.length
            });
          }
        }
      }
    }
    const topicProgress = Array.from(topicProgressMap.entries()).map(
      ([id, data]) => ({
        id,
        ...data
      })
    );
    const recentAttempts = attempts.slice(0, 10).map((a) => ({
      id: a.id,
      date: a.createdAt.toISOString(),
      score: a.score,
      mode: a.mode,
      topicTitle: void 0
    }));
    res.json({
      totalAttempts: stats.totalAttempts,
      averageAccuracy: stats.averageScore,
      topicsCompleted,
      totalTopics,
      topicProgress,
      recentAttempts
    });
  } catch (error) {
    console.error("Get progress error:", error);
    res.status(500).json({ message: "Failed to get progress" });
  }
});
router5.get("/topic/:topicId", authMiddleware, async (req, res) => {
  try {
    const { topicId } = req.params;
    const topic = await storage.getTopic(topicId);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }
    const chapter = await storage.getChapter(topic.chapterId);
    const attempts = await storage.getQuizAttempts(req.userId);
    const topicAttempts = attempts.filter((a) => a.topicId === topicId);
    const accuracyTrend = topicAttempts.map((a) => ({
      date: a.createdAt.toISOString(),
      score: a.score
    }));
    const avgScore = topicAttempts.length > 0 ? Math.round(
      topicAttempts.reduce((sum, a) => sum + a.score, 0) / topicAttempts.length
    ) : 0;
    const bestScore = topicAttempts.length > 0 ? Math.max(...topicAttempts.map((a) => a.score)) : 0;
    const lastAttempt = topicAttempts.length > 0 ? topicAttempts[0].createdAt.toISOString() : null;
    const recentAttempts = topicAttempts.slice(0, 10).map((a) => ({
      id: a.id,
      date: a.createdAt.toISOString(),
      score: a.score,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      totalQuestions: a.totalQuestions
    }));
    res.json({
      topicId,
      topicTitle: topic.title,
      chapterTitle: chapter?.title || "",
      totalAttempts: topicAttempts.length,
      averageScore: avgScore,
      bestScore,
      lastAttempt,
      accuracyTrend,
      recentAttempts
    });
  } catch (error) {
    console.error("Get topic progress error:", error);
    res.status(500).json({ message: "Failed to get topic progress" });
  }
});
var progress_default = router5;

// server/routes/attempts.ts
import { Router as Router6 } from "express";
var router6 = Router6();
router6.get("/", authMiddleware, async (req, res) => {
  try {
    const { mode, topicId, startDate, endDate } = req.query;
    const attempts = await storage.getQuizAttempts(req.userId);
    let filteredAttempts = attempts;
    if (mode && mode !== "all") {
      filteredAttempts = filteredAttempts.filter((a) => a.mode === mode);
    }
    if (topicId) {
      filteredAttempts = filteredAttempts.filter((a) => a.topicId === topicId);
    }
    if (startDate) {
      const start = new Date(startDate);
      filteredAttempts = filteredAttempts.filter(
        (a) => new Date(a.createdAt) >= start
      );
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredAttempts = filteredAttempts.filter(
        (a) => new Date(a.createdAt) <= end
      );
    }
    const attemptsWithDetails = await Promise.all(
      filteredAttempts.map(async (a) => {
        let topicTitle = void 0;
        if (a.topicId) {
          const topic = await storage.getTopic(a.topicId);
          topicTitle = topic?.title;
        }
        return {
          id: a.id,
          date: a.createdAt.toISOString(),
          score: a.score,
          totalQuestions: a.totalQuestions,
          correctCount: a.correctCount,
          wrongCount: a.wrongCount,
          timeTaken: a.timeTaken,
          mode: a.mode,
          topicId: a.topicId,
          topicTitle
        };
      })
    );
    res.json(attemptsWithDetails);
  } catch (error) {
    console.error("Get attempts error:", error);
    res.status(500).json({ message: "Failed to get attempts" });
  }
});
router6.get("/:attemptId", authMiddleware, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await storage.getQuizAttempt(attemptId);
    if (!attempt || attempt.userId !== req.userId) {
      return res.status(404).json({ message: "Attempt not found" });
    }
    let topicTitle = void 0;
    if (attempt.topicId) {
      const topic = await storage.getTopic(attempt.topicId);
      topicTitle = topic?.title;
    }
    const answersData = attempt.answers;
    const questionIds = Object.keys(answersData);
    const questionsWithDetails = await Promise.all(
      questionIds.map(async (qId) => {
        const mcq = await storage.getMCQ(qId);
        const answerInfo = answersData[qId];
        return {
          id: qId,
          question: mcq?.question || "Question not found",
          options: mcq?.options || [],
          selectedAnswer: answerInfo.selected,
          correctAnswer: answerInfo.correct,
          isCorrect: answerInfo.isCorrect,
          explanation: mcq?.explanation || ""
        };
      })
    );
    res.json({
      id: attempt.id,
      date: attempt.createdAt.toISOString(),
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      timeTaken: attempt.timeTaken,
      mode: attempt.mode,
      topicId: attempt.topicId,
      topicTitle,
      questions: questionsWithDetails
    });
  } catch (error) {
    console.error("Get attempt detail error:", error);
    res.status(500).json({ message: "Failed to get attempt detail" });
  }
});
var attempts_default = router6;

// server/routes/index.ts
async function registerRoutes(app2) {
  app2.use("/api/auth", auth_default);
  app2.use("/api/profile", user_default);
  app2.use("/api", user_default);
  app2.use("/api", content_default);
  app2.use("/api/quiz", quiz_default);
  app2.use("/api/progress", progress_default);
  app2.use("/api/attempts", attempts_default);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
