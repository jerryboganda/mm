import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
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
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("student"),
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  subscriptionPlan: text("subscription_plan"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  deactivatedAt: timestamp("deactivated_at"),
  deactivationReason: text("deactivation_reason"),
  deletionRequestedAt: timestamp("deletion_requested_at"),
  deletionStatus: text("deletion_status").notNull().default("none"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  emailVerificationToken: text("email_verification_token"),
  emailTokenExpiresAt: timestamp("email_token_expires_at"),
  phoneNumber: text("phone_number"),
  isPhoneVerified: boolean("is_phone_verified").default(false).notNull(),
  phoneVerificationToken: text("phone_verification_token"),
  phoneTokenExpiresAt: timestamp("phone_token_expires_at"),
  deviceLimitOverrideEnabled: boolean("device_limit_override_enabled")
    .default(false)
    .notNull(),
  deviceLimitMax: integer("device_limit_max"),
});

export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  bookmarks: many(bookmarks),
  quizAttempts: many(quizAttempts),
  subscriptions: many(subscriptions),
  sessions: many(userSessions),
}));

export const userSessions = pgTable(
  "user_sessions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    deviceLabel: text("device_label"),
    platform: text("platform"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    revokedBy: varchar("revoked_by").references(() => users.id, {
      onDelete: "set null",
    }),
    revokeReason: text("revoke_reason"),
  },
  (table) => [
    index("idx_user_sessions_user_active").on(table.userId, table.isActive),
    index("idx_user_sessions_device").on(table.userId, table.deviceId),
  ],
);

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
  revokedByUser: one(users, {
    fields: [userSessions.revokedBy],
    references: [users.id],
  }),
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

export const chapters = pgTable(
  "chapters",
  {
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
  },
  (table) => [
    index("idx_chapters_book_published").on(table.bookId, table.isPublished),
  ],
);

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  book: one(books, {
    fields: [chapters.bookId],
    references: [books.id],
  }),
  topics: many(topics),
}));

export const topics = pgTable(
  "topics",
  {
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
    isPaid: boolean("is_paid").default(false).notNull(),
    author: text("author"),
    source: text("source"),
    references: text("references"),
    lastReviewedAt: timestamp("last_reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_topics_chapter_published").on(
      table.chapterId,
      table.isPublished,
    ),
  ],
);

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
  // Optional explanation figures: [{ url: string, caption?: string }]
  // Additive/nullable so existing rows and callers are unaffected.
  images: jsonb("images"),
  isPublished: boolean("is_published").default(true),
  isPaid: boolean("is_paid").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mcqsRelations = relations(mcqs, ({ one }) => ({
  topic: one(topics, {
    fields: [mcqs.topicId],
    references: [topics.id],
  }),
}));

export const userProgress = pgTable(
  "user_progress",
  {
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
  },
  (table) => [
    index("idx_user_progress_user_topic").on(table.userId, table.topicId),
    index("idx_user_progress_user_completed").on(
      table.userId,
      table.isCompleted,
    ),
  ],
);

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

export const bookmarks = pgTable(
  "bookmarks",
  {
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
  },
  (table) => [
    uniqueIndex("idx_bookmarks_user_topic").on(table.userId, table.topicId),
  ],
);

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

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
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
  },
  (table) => [
    index("idx_quiz_attempts_user_created").on(table.userId, table.createdAt),
  ],
);

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

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
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
  },
  (table) => [
    index("idx_password_reset_token_lookup").on(
      table.token,
      table.used,
      table.expiresAt,
    ),
  ],
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const recentActivity = pgTable(
  "recent_activity",
  {
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
  },
  (table) => [
    index("idx_recent_activity_user_viewed").on(table.userId, table.viewedAt),
  ],
);

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
export const reviewSchedule = pgTable(
  "review_schedule",
  {
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
  },
  (table) => [
    index("idx_review_schedule_user_next").on(table.userId, table.nextReviewAt),
  ],
);

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

// ── Admin App Settings (key-value store) ──────────────────────────
export const appSettings = pgTable("app_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Announcements ──────────────────────────
export const announcements = pgTable(
  "announcements",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("info"), // 'info' | 'warning' | 'update' | 'promo'
    isActive: boolean("is_active").default(true),
    expiresAt: timestamp("expires_at"),
    createdBy: varchar("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_announcements_active_created").on(
      table.isActive,
      table.createdAt,
    ),
  ],
);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  creator: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
}));

// ── Audit Logs ──────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'create' | 'update' | 'delete' | 'publish' | 'unpublish'
  entityType: text("entity_type").notNull(), // 'book' | 'chapter' | 'topic' | 'mcq' | 'user' | 'announcement'
  entityId: varchar("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  admin: one(users, {
    fields: [auditLogs.adminUserId],
    references: [users.id],
  }),
}));

// ── Content Error Reports (TRUST-003) ──────────────────────────
export const contentReports = pgTable(
  "content_reports",
  {
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
  },
  (table) => [
    index("idx_content_reports_status_created").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const contentReportsRelations = relations(contentReports, ({ one }) => ({
  user: one(users, {
    fields: [contentReports.userId],
    references: [users.id],
  }),
}));

// ══════════════════════════════════════════════════════════════════
// ══  SUBSCRIPTION MANAGEMENT SYSTEM                            ══
// ══════════════════════════════════════════════════════════════════

// ── 1. Subscription Packages ──────────────────────────────────
export const subscriptionPackages = pgTable(
  "subscription_packages",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    shortDescription: text("short_description"),
    iconUrl: text("icon_url"),
    // Status: active (purchasable), inactive (hidden), archived (soft-deleted, existing subs honored)
    status: text("status").notNull().default("active"),
    isVisibleToUsers: boolean("is_visible_to_users").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    // Trial configuration
    trialDays: integer("trial_days").default(0).notNull(),
    trialRequiresPaymentMethod: boolean("trial_requires_payment_method")
      .default(false)
      .notNull(),
    // Grace period (days after expiry before feature lockout)
    gracePeriodDays: integer("grace_period_days").default(0).notNull(),
    // Subscriber limits (0 = unlimited)
    maxSubscribers: integer("max_subscribers").default(0).notNull(),
    // Package versioning — version increments when pricing/features change
    version: integer("version").default(1).notNull(),
    // Extensible metadata (for gateway-specific IDs, feature flags, etc.)
    metadata: jsonb("metadata"),
    // RevenueCat product mapping
    revenuecatProductId: text("revenuecat_product_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sub_pkg_status").on(table.status),
    index("idx_sub_pkg_display_order").on(table.displayOrder),
  ],
);

export const subscriptionPackagesRelations = relations(
  subscriptionPackages,
  ({ many }) => ({
    prices: many(packagePrices),
    features: many(packageFeatures),
    subscriptions: many(subscriptions),
  }),
);

// ── 2. Package Prices (polymorphic billing cycles) ────────────
export const packagePrices = pgTable(
  "package_prices",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    packageId: varchar("package_id")
      .notNull()
      .references(() => subscriptionPackages.id, { onDelete: "cascade" }),
    // Billing cycle: monthly, quarterly, semi_annual, annual, lifetime, custom
    billingCycle: text("billing_cycle").notNull(),
    // Custom cycle duration in days (used when billingCycle = 'custom')
    customDurationDays: integer("custom_duration_days"),
    // Price in smallest currency unit (e.g., cents). Use numeric for precision.
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("PKR"),
    // Original price for strike-through display
    originalPrice: numeric("original_price", { precision: 12, scale: 2 }),
    isActive: boolean("is_active").default(true).notNull(),
    // RevenueCat offering/package mapping
    revenuecatOfferingId: text("revenuecat_offering_id"),
    // Versioning — ties to package version when this price was created
    packageVersion: integer("package_version").default(1).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pkg_price_package").on(table.packageId),
    index("idx_pkg_price_cycle").on(table.billingCycle),
  ],
);

export const packagePricesRelations = relations(packagePrices, ({ one }) => ({
  package: one(subscriptionPackages, {
    fields: [packagePrices.packageId],
    references: [subscriptionPackages.id],
  }),
}));

// ── 3. Package Features (for comparison matrix) ───────────────
export const packageFeatures = pgTable(
  "package_features",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    packageId: varchar("package_id")
      .notNull()
      .references(() => subscriptionPackages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // For comparison matrix: check, cross, limited, number (e.g., "50 MCQs/day")
    valueType: text("value_type").notNull().default("check"),
    value: text("value"),
    displayOrder: integer("display_order").default(0).notNull(),
    // Feature key for programmatic checking (e.g., "full_content_access", "unlimited_mcqs")
    featureKey: text("feature_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_pkg_feature_package").on(table.packageId)],
);

export const packageFeaturesRelations = relations(
  packageFeatures,
  ({ one }) => ({
    package: one(subscriptionPackages, {
      fields: [packageFeatures.packageId],
      references: [subscriptionPackages.id],
    }),
  }),
);

// ── 4. Add-Ons ────────────────────────────────────────────────
export const addOns = pgTable(
  "add_ons",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    // Pricing: one_time or recurring
    pricingType: text("pricing_type").notNull().default("one_time"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("PKR"),
    // If recurring, how often
    billingCycle: text("billing_cycle"),
    // Quantity limits per user (0 = unlimited)
    maxQuantityPerUser: integer("max_quantity_per_user").default(1).notNull(),
    // Compatibility: null = compatible with all packages, otherwise JSON array of package IDs
    compatiblePackageIds: jsonb("compatible_package_ids"),
    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_addon_status").on(table.isActive)],
);

// ── 5. Add-On Bundles ─────────────────────────────────────────
export const addOnBundles = pgTable("add_on_bundles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  // Discounted bundle price
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PKR"),
  // JSON array of add-on IDs in this bundle
  addOnIds: jsonb("add_on_ids").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── 6. Coupons / Discount Engine ──────────────────────────────
export const coupons = pgTable(
  "coupons",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: text("code").notNull().unique(),
    description: text("description"),
    // Campaign grouping for bulk-generated codes
    campaignId: varchar("campaign_id"),
    // Discount type: percentage, fixed_amount, trial_extension
    discountType: text("discount_type").notNull(),
    // Discount value (percentage 0-100, or fixed amount, or trial days to add)
    discountValue: numeric("discount_value", {
      precision: 12,
      scale: 2,
    }).notNull(),
    // Minimum purchase amount required
    minPurchaseAmount: numeric("min_purchase_amount", {
      precision: 12,
      scale: 2,
    }),
    // Maximum discount cap (for percentage discounts)
    maxDiscountAmount: numeric("max_discount_amount", {
      precision: 12,
      scale: 2,
    }),
    // Applicability: null = all packages/add-ons, otherwise JSON arrays of IDs
    applicablePackageIds: jsonb("applicable_package_ids"),
    applicableAddOnIds: jsonb("applicable_add_on_ids"),
    // Usage limits
    maxTotalUses: integer("max_total_uses"), // null = unlimited
    maxUsesPerUser: integer("max_uses_per_user").default(1).notNull(),
    currentUseCount: integer("current_use_count").default(0).notNull(),
    // Validity period
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),
    // Stacking rules
    isStackable: boolean("is_stackable").default(false).notNull(),
    // Referral/affiliate tracking
    referralUserId: varchar("referral_user_id").references(() => users.id),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_coupon_code").on(table.code),
    index("idx_coupon_campaign").on(table.campaignId),
    index("idx_coupon_active").on(table.isActive),
    index("idx_coupon_validity").on(table.validFrom, table.validUntil),
  ],
);

export const couponsRelations = relations(coupons, ({ one, many }) => ({
  referrer: one(users, {
    fields: [coupons.referralUserId],
    references: [users.id],
  }),
  usage: many(couponUsage),
}));

// ── 7. Coupon Usage Tracking ──────────────────────────────────
export const couponUsage = pgTable(
  "coupon_usage",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    couponId: varchar("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: varchar("subscription_id"),
    // Amount discounted
    discountApplied: numeric("discount_applied", {
      precision: 12,
      scale: 2,
    }).notNull(),
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_coupon_usage_coupon").on(table.couponId),
    index("idx_coupon_usage_user").on(table.userId),
  ],
);

export const couponUsageRelations = relations(couponUsage, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponUsage.couponId],
    references: [coupons.id],
  }),
  user: one(users, {
    fields: [couponUsage.userId],
    references: [users.id],
  }),
}));

// ── 8. Subscriptions (lifecycle tracking) ─────────────────────
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packageId: varchar("package_id")
      .notNull()
      .references(() => subscriptionPackages.id),
    priceId: varchar("price_id").references(() => packagePrices.id),
    // State machine: trialing → active → past_due → paused → canceled → expired
    status: text("status").notNull().default("trialing"),
    // Dates for every lifecycle transition
    trialStartAt: timestamp("trial_start_at"),
    trialEndAt: timestamp("trial_end_at"),
    activatedAt: timestamp("activated_at"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    canceledAt: timestamp("canceled_at"),
    cancelReason: text("cancel_reason"),
    // cancel_at_period_end: true = cancel at end of current period, false = immediate
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(true).notNull(),
    pausedAt: timestamp("paused_at"),
    resumedAt: timestamp("resumed_at"),
    expiredAt: timestamp("expired_at"),
    // Grace period tracking
    gracePeriodEndAt: timestamp("grace_period_end_at"),
    // Dunning management (failed payment retries)
    failedPaymentCount: integer("failed_payment_count").default(0).notNull(),
    lastPaymentFailedAt: timestamp("last_payment_failed_at"),
    nextRetryAt: timestamp("next_retry_at"),
    // Billing
    billingCycle: text("billing_cycle").notNull(),
    priceAtPurchase: numeric("price_at_purchase", {
      precision: 12,
      scale: 2,
    }).notNull(),
    currency: text("currency").notNull().default("PKR"),
    // Applied coupon
    couponId: varchar("coupon_id").references(() => coupons.id),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }),
    // External references
    externalSubscriptionId: text("external_subscription_id"), // RevenueCat/Stripe/etc ID
    paymentGateway: text("payment_gateway").default("revenuecat"), // revenuecat, stripe, paypal, manual
    // Package version at time of subscription (for grandfathering)
    packageVersionAtPurchase: integer("package_version_at_purchase")
      .default(1)
      .notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sub_user").on(table.userId),
    index("idx_sub_package").on(table.packageId),
    index("idx_sub_status").on(table.status),
    index("idx_sub_period_end").on(table.currentPeriodEnd),
    index("idx_sub_external_id").on(table.externalSubscriptionId),
  ],
);

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [subscriptions.userId],
      references: [users.id],
    }),
    package: one(subscriptionPackages, {
      fields: [subscriptions.packageId],
      references: [subscriptionPackages.id],
    }),
    price: one(packagePrices, {
      fields: [subscriptions.priceId],
      references: [packagePrices.id],
    }),
    coupon: one(coupons, {
      fields: [subscriptions.couponId],
      references: [coupons.id],
    }),
    addOns: many(subscriptionAddOns),
    invoices: many(invoices),
  }),
);

// ── 9. Subscription Add-Ons (attached to a subscription) ─────
export const subscriptionAddOns = pgTable(
  "subscription_add_ons",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    subscriptionId: varchar("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    addOnId: varchar("add_on_id")
      .notNull()
      .references(() => addOns.id),
    quantity: integer("quantity").default(1).notNull(),
    priceAtPurchase: numeric("price_at_purchase", {
      precision: 12,
      scale: 2,
    }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    activatedAt: timestamp("activated_at").defaultNow().notNull(),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sub_addon_subscription").on(table.subscriptionId),
    index("idx_sub_addon_addon").on(table.addOnId),
  ],
);

export const subscriptionAddOnsRelations = relations(
  subscriptionAddOns,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [subscriptionAddOns.subscriptionId],
      references: [subscriptions.id],
    }),
    addOn: one(addOns, {
      fields: [subscriptionAddOns.addOnId],
      references: [addOns.id],
    }),
  }),
);

// ── 10. Invoices ──────────────────────────────────────────────
export const invoices = pgTable(
  "invoices",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // Human-readable invoice number (e.g., INV-2026-0001)
    invoiceNumber: text("invoice_number").notNull().unique(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: varchar("subscription_id").references(
      () => subscriptions.id,
    ),
    // Status: draft, open, paid, void, uncollectible
    status: text("status").notNull().default("draft"),
    // Amounts
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    discountTotal: numeric("discount_total", {
      precision: 12,
      scale: 2,
    }).default("0"),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("PKR"),
    // Payment tracking
    paidAt: timestamp("paid_at"),
    dueAt: timestamp("due_at"),
    // Period covered
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    // Applied coupon for reference
    couponId: varchar("coupon_id").references(() => coupons.id),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_invoice_user").on(table.userId),
    index("idx_invoice_subscription").on(table.subscriptionId),
    index("idx_invoice_status").on(table.status),
  ],
);

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
  coupon: one(coupons, {
    fields: [invoices.couponId],
    references: [coupons.id],
  }),
  lineItems: many(invoiceLineItems),
  transactions: many(paymentTransactions),
}));

// ── 11. Invoice Line Items ────────────────────────────────────
export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    invoiceId: varchar("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    // Type: subscription, add_on, proration_credit, proration_charge
    type: text("type").notNull(),
    description: text("description").notNull(),
    // Reference to package/add-on
    packageId: varchar("package_id").references(() => subscriptionPackages.id),
    addOnId: varchar("add_on_id").references(() => addOns.id),
    quantity: integer("quantity").default(1).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    // Period for prorations
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_line_item_invoice").on(table.invoiceId)],
);

export const invoiceLineItemsRelations = relations(
  invoiceLineItems,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [invoiceLineItems.invoiceId],
      references: [invoices.id],
    }),
    package: one(subscriptionPackages, {
      fields: [invoiceLineItems.packageId],
      references: [subscriptionPackages.id],
    }),
    addOn: one(addOns, {
      fields: [invoiceLineItems.addOnId],
      references: [addOns.id],
    }),
  }),
);

// ── 12. Payment Transactions ──────────────────────────────────
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    invoiceId: varchar("invoice_id").references(() => invoices.id),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Status: pending, succeeded, failed, refunded, disputed
    status: text("status").notNull().default("pending"),
    // Amount and currency
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("PKR"),
    // Gateway details
    paymentGateway: text("payment_gateway").notNull(), // revenuecat, stripe, paypal, manual
    gatewayTransactionId: text("gateway_transaction_id"),
    gatewayResponse: jsonb("gateway_response"),
    // Failure details
    failureReason: text("failure_reason"),
    failureCode: text("failure_code"),
    // Refund tracking
    refundedAmount: numeric("refunded_amount", { precision: 12, scale: 2 }),
    refundedAt: timestamp("refunded_at"),
    refundReason: text("refund_reason"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_txn_invoice").on(table.invoiceId),
    index("idx_txn_user").on(table.userId),
    index("idx_txn_status").on(table.status),
    index("idx_txn_gateway_id").on(table.gatewayTransactionId),
  ],
);

export const paymentTransactionsRelations = relations(
  paymentTransactions,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [paymentTransactions.invoiceId],
      references: [invoices.id],
    }),
    user: one(users, {
      fields: [paymentTransactions.userId],
      references: [users.id],
    }),
  }),
);

// ── 13. Subscription Audit Log ────────────────────────────────
export const subscriptionAuditLogs = pgTable(
  "subscription_audit_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    subscriptionId: varchar("subscription_id").references(
      () => subscriptions.id,
    ),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Who performed this action (null = system/webhook, non-null = admin/user)
    performedBy: varchar("performed_by").references(() => users.id),
    // Action: created, activated, renewed, upgraded, downgraded, paused, resumed,
    //         canceled, expired, reactivated, payment_failed, payment_succeeded,
    //         coupon_applied, add_on_added, add_on_removed, admin_override
    action: text("action").notNull(),
    // Previous and new status for state transitions
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),
    // Additional context
    details: jsonb("details"),
    // Source: webhook, client_sync, admin_panel, system_cron, api
    source: text("source").notNull().default("system"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sub_audit_subscription").on(table.subscriptionId),
    index("idx_sub_audit_user").on(table.userId),
    index("idx_sub_audit_action").on(table.action),
    index("idx_sub_audit_created").on(table.createdAt),
  ],
);

export const subscriptionAuditLogsRelations = relations(
  subscriptionAuditLogs,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [subscriptionAuditLogs.subscriptionId],
      references: [subscriptions.id],
    }),
    user: one(users, {
      fields: [subscriptionAuditLogs.userId],
      references: [users.id],
    }),
    performer: one(users, {
      fields: [subscriptionAuditLogs.performedBy],
      references: [users.id],
    }),
  }),
);

// ── 14. Manual Payment Proofs ─────────────────────────────────
// User-submitted proof of a manual (offline) payment for a subscription
// package. An admin reviews the proof and approves (which provisions a
// subscription via subscriptionService.createSubscription with
// paymentGateway="manual") or rejects it.
export const manualPaymentProofs = pgTable(
  "manual_payment_proofs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packageId: varchar("package_id")
      .notNull()
      .references(() => subscriptionPackages.id),
    priceId: varchar("price_id").references(() => packagePrices.id),
    // Review state: pending → approved | rejected
    status: text("status").notNull().default("pending"),
    // What the user claims they paid (informational; admin verifies the image)
    amountClaimed: numeric("amount_claimed", { precision: 12, scale: 2 }),
    currency: text("currency"),
    // e.g. "Bank Transfer", "JazzCash", "Easypaisa"
    paymentMethod: text("payment_method"),
    // Sender name / transaction id the user provides
    senderReference: text("sender_reference"),
    userNote: text("user_note"),
    // Uploaded proof image (served from /uploads/payment-proofs)
    proofImageUrl: text("proof_image_url").notNull(),
    proofFilename: text("proof_filename"),
    // Admin review
    reviewedBy: varchar("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    // Subscription created on approval
    createdSubscriptionId: varchar("created_subscription_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_manual_proof_user").on(table.userId),
    index("idx_manual_proof_status").on(table.status),
    index("idx_manual_proof_created").on(table.createdAt),
  ],
);

export const manualPaymentProofsRelations = relations(
  manualPaymentProofs,
  ({ one }) => ({
    user: one(users, {
      fields: [manualPaymentProofs.userId],
      references: [users.id],
    }),
    package: one(subscriptionPackages, {
      fields: [manualPaymentProofs.packageId],
      references: [subscriptionPackages.id],
    }),
    price: one(packagePrices, {
      fields: [manualPaymentProofs.priceId],
      references: [packagePrices.id],
    }),
    reviewer: one(users, {
      fields: [manualPaymentProofs.reviewedBy],
      references: [users.id],
    }),
  }),
);

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
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().optional(),
  email: z.string().email().optional(),
  code: z.string().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// ── Subscription Zod Schemas ──────────────────────────────────

export const subscriptionStatusEnum = z.enum([
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "expired",
  "none",
]);

export const billingCycleEnum = z.enum([
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "lifetime",
  "custom",
]);

export const packageStatusEnum = z.enum(["active", "inactive", "archived"]);

export const discountTypeEnum = z.enum([
  "percentage",
  "fixed_amount",
  "trial_extension",
]);

export const createPackageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  iconUrl: z.string().url().optional().or(z.literal("")),
  status: packageStatusEnum.default("active"),
  isVisibleToUsers: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  trialDays: z.number().int().min(0).default(0),
  trialRequiresPaymentMethod: z.boolean().default(false),
  gracePeriodDays: z.number().int().min(0).default(0),
  maxSubscribers: z.number().int().min(0).default(0),
  revenuecatProductId: z.string().optional(),
  metadata: z.any().optional(),
});

export const updatePackageSchema = createPackageSchema.partial();

export const createPackagePriceSchema = z.object({
  packageId: z.string().min(1),
  billingCycle: billingCycleEnum,
  customDurationDays: z.number().int().min(1).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  currency: z.string().default("PKR"),
  originalPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  isActive: z.boolean().default(true),
  revenuecatOfferingId: z.string().optional(),
  metadata: z.any().optional(),
});

export const createPackageFeatureSchema = z.object({
  packageId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  valueType: z.enum(["check", "cross", "limited", "number"]).default("check"),
  value: z.string().optional(),
  displayOrder: z.number().int().default(0),
  featureKey: z.string().optional(),
});

export const createAddOnSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  pricingType: z.enum(["one_time", "recurring"]).default("one_time"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().default("PKR"),
  billingCycle: billingCycleEnum.optional(),
  maxQuantityPerUser: z.number().int().min(1).default(1),
  compatiblePackageIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  metadata: z.any().optional(),
});

export const updateAddOnSchema = createAddOnSchema.partial();

export const createCouponSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  campaignId: z.string().optional(),
  discountType: discountTypeEnum,
  discountValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
  minPurchaseAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  maxDiscountAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  applicablePackageIds: z.array(z.string()).optional(),
  applicableAddOnIds: z.array(z.string()).optional(),
  maxTotalUses: z.number().int().min(1).optional(),
  maxUsesPerUser: z.number().int().min(1).default(1),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  isStackable: z.boolean().default(false),
  referralUserId: z.string().optional(),
  isActive: z.boolean().default(true),
  metadata: z.any().optional(),
});

export const updateCouponSchema = createCouponSchema.partial();

export const validateCouponSchema = z.object({
  code: z.string().min(1),
  packageId: z.string().optional(),
  addOnId: z.string().optional(),
});

// ── Manual Payment Proof Zod Schemas ──────────────────────────

export const submitPaymentProofSchema = z.object({
  packageId: z.string().min(1, "packageId is required"),
  priceId: z.string().min(1, "priceId is required"),
  amountClaimed: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  paymentMethod: z.string().max(100).optional(),
  senderReference: z.string().max(200).optional(),
  userNote: z.string().max(1000).optional(),
});

export const reviewPaymentProofSchema = z.object({
  rejectionReason: z.string().max(1000).optional(),
});

export const manualGrantSchema = z
  .object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    packageId: z.string().min(1, "packageId is required"),
    priceId: z.string().min(1, "priceId is required"),
  })
  .refine((d) => !!d.userId || !!d.email, {
    message: "Either userId or email is required",
    path: ["email"],
  });

// Admin-configurable payment instructions stored in app_settings under
// the key "payment_instructions".
export const paymentInstructionsSchema = z.object({
  currency: z.string().default("PKR"),
  instructions: z.string().default(""),
  whatsappNumber: z.string().default("+923360830836"),
  supportEmail: z.string().default("maternalmind.help@gmail.com"),
  bank: z
    .object({
      bankName: z.string().default(""),
      accountTitle: z.string().default(""),
      accountNumber: z.string().default(""),
      iban: z.string().default(""),
      branch: z.string().default(""),
    })
    .default({
      bankName: "",
      accountTitle: "",
      accountNumber: "",
      iban: "",
      branch: "",
    }),
  wallets: z
    .array(
      z.object({
        name: z.string().default(""),
        accountTitle: z.string().default(""),
        number: z.string().default(""),
        iban: z.string().optional(),
      }),
    )
    .default([]),
});
export type PaymentInstructions = z.infer<typeof paymentInstructionsSchema>;

export const bulkCouponGenerationSchema = z.object({
  count: z.number().int().min(1).max(10000),
  prefix: z.string().min(1).max(20),
  campaignId: z.string().optional(),
  discountType: discountTypeEnum,
  discountValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
  maxUsesPerUser: z.number().int().min(1).default(1),
  maxTotalUses: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  applicablePackageIds: z.array(z.string()).optional(),
  isStackable: z.boolean().default(false),
  metadata: z.any().optional(),
});

// ── Type Exports ──────────────────────────────────────────────

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
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
export type AppSetting = typeof appSettings.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// Subscription System Types
export type SubscriptionPackage = typeof subscriptionPackages.$inferSelect;
export type PackagePrice = typeof packagePrices.$inferSelect;
export type PackageFeature = typeof packageFeatures.$inferSelect;
export type AddOn = typeof addOns.$inferSelect;
export type AddOnBundle = typeof addOnBundles.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type CouponUsage = typeof couponUsage.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionAddOn = typeof subscriptionAddOns.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type SubscriptionAuditLog = typeof subscriptionAuditLogs.$inferSelect;
export type ManualPaymentProof = typeof manualPaymentProofs.$inferSelect;
export type InsertManualPaymentProof =
  typeof manualPaymentProofs.$inferInsert;

// ── Website Marketing Tables ──────────────────────────────────
export const waitlistEntries = pgTable("waitlist_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const newsletterEntries = pgTable("newsletter_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const institutionalRequests = pgTable("institutional_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  institution: text("institution").notNull(),
  role: text("role").notNull(),
  email: text("email").notNull(),
  cohortSize: text("cohort_size"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWaitlistSchema = createInsertSchema(waitlistEntries).pick({
  email: true,
});

export const insertNewsletterSchema = createInsertSchema(newsletterEntries).pick({
  email: true,
});

export const insertContactSchema = createInsertSchema(contactMessages).pick({
  name: true,
  email: true,
  subject: true,
  message: true,
});

export const insertInstitutionalRequestSchema = createInsertSchema(
  institutionalRequests,
).pick({
  name: true,
  institution: true,
  role: true,
  email: true,
  cohortSize: true,
  message: true,
});

export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type NewsletterEntry = typeof newsletterEntries.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InstitutionalRequest = typeof institutionalRequests.$inferSelect;

