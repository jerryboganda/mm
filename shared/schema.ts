import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("student"),
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  subscriptionPlan: text("subscription_plan"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  emailVerificationToken: text("email_verification_token"),
  emailTokenExpiresAt: timestamp("email_token_expires_at"),
  phoneNumber: text("phone_number"),
  isPhoneVerified: boolean("is_phone_verified").default(false).notNull(),
  phoneVerificationToken: text("phone_verification_token"),
  phoneTokenExpiresAt: timestamp("phone_token_expires_at"),
});

export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  bookmarks: many(bookmarks),
  quizAttempts: many(quizAttempts),
}));

export const books = pgTable("books", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  isPublished: boolean("is_published").default(false),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const booksRelations = relations(books, ({ many }) => ({
  chapters: many(chapters),
}));

export const chapters = pgTable("chapters", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  bookId: varchar("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  order: integer("order").default(0),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  book: one(books, {
    fields: [chapters.bookId],
    references: [books.id],
  }),
  topics: many(topics),
}));

export const topics = pgTable("topics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  order: integer("order").default(0),
  isPublished: boolean("is_published").default(false),
  author: text("author"),
  source: text("source"),
  references: text("references"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const topicsRelations = relations(topics, ({ one, many }) => ({
  chapter: one(chapters, {
    fields: [topics.chapterId],
    references: [chapters.id],
  }),
  contentBlocks: many(contentBlocks),
  mcqs: many(mcqs),
}));

export const contentBlocks = pgTable("content_blocks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content").notNull(),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contentBlocksRelations = relations(contentBlocks, ({ one }) => ({
  topic: one(topics, {
    fields: [contentBlocks.topicId],
    references: [topics.id],
  }),
}));

export const mcqs = pgTable("mcqs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation"),
  optionExplanations: jsonb("option_explanations"),
  difficulty: text("difficulty").notNull().default("medium"),
  references: text("references"),
  tags: jsonb("tags"),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mcqsRelations = relations(mcqs, ({ one }) => ({
  topic: one(topics, {
    fields: [mcqs.topicId],
    references: [topics.id],
  }),
}));

export const userProgress = pgTable("user_progress", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [userProgress.topicId],
    references: [topics.id],
  }),
}));

export const bookmarks = pgTable("bookmarks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [bookmarks.topicId],
    references: [topics.id],
  }),
}));

export const quizAttempts = pgTable("quiz_attempts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id").references(() => topics.id, {
    onDelete: "set null",
  }),
  mode: text("mode").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  correctCount: integer("correct_count").notNull(),
  wrongCount: integer("wrong_count").notNull(),
  timeTaken: integer("time_taken"),
  answers: jsonb("answers").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [quizAttempts.topicId],
    references: [topics.id],
  }),
}));

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const recentActivity = pgTable("recent_activity", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const recentActivityRelations = relations(recentActivity, ({ one }) => ({
  user: one(users, {
    fields: [recentActivity.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [recentActivity.topicId],
    references: [topics.id],
  }),
}));

// ── Spaced Repetition (SM-2 algorithm) ──────────────────────────
export const reviewSchedule = pgTable("review_schedule", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mcqId: varchar("mcq_id")
    .notNull()
    .references(() => mcqs.id, { onDelete: "cascade" }),
  easeFactor: integer("ease_factor").notNull().default(250), // stored as int × 100 (2.50 → 250)
  interval: integer("interval").notNull().default(1), // days until next review
  repetitions: integer("repetitions").notNull().default(0),
  nextReviewAt: timestamp("next_review_at").defaultNow().notNull(),
  lastReviewedAt: timestamp("last_reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewScheduleRelations = relations(reviewSchedule, ({ one }) => ({
  user: one(users, {
    fields: [reviewSchedule.userId],
    references: [users.id],
  }),
  mcq: one(mcqs, {
    fields: [reviewSchedule.mcqId],
    references: [mcqs.id],
  }),
}));

// ── Content Error Reports (TRUST-003) ──────────────────────────
export const contentReports = pgTable("content_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // 'topic' | 'mcq' | 'content_block'
  contentId: varchar("content_id").notNull(),
  reportType: text("report_type").notNull(), // 'error' | 'outdated' | 'unclear' | 'other'
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contentReportsRelations = relations(contentReports, ({ one }) => ({
  user: one(users, {
    fields: [contentReports.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  isEmailVerified: true,
  emailVerificationToken: true,
  emailTokenExpiresAt: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type MCQ = typeof mcqs.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type RecentActivity = typeof recentActivity.$inferSelect;
export type ReviewSchedule = typeof reviewSchedule.$inferSelect;
export type ContentReport = typeof contentReports.$inferSelect;
