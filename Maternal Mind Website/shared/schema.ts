import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

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

export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  platform: text("platform").notNull(),
  message: text("message"),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertWaitlistSchema = createInsertSchema(waitlistEntries).pick({
  email: true,
});

export const insertNewsletterSchema = createInsertSchema(
  newsletterEntries,
).pick({
  email: true,
});

export const insertContactSchema = createInsertSchema(contactMessages).pick({
  name: true,
  email: true,
  subject: true,
  message: true,
});

export const accountDeletionPlatformSchema = z.enum([
  "android",
  "ios",
  "web",
  "unknown",
]);

export const insertAccountDeletionRequestSchema = createInsertSchema(
  accountDeletionRequests,
)
  .pick({
    name: true,
    email: true,
    platform: true,
    message: true,
  })
  .extend({
    platform: accountDeletionPlatformSchema,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type NewsletterEntry = typeof newsletterEntries.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertAccountDeletionRequest = z.infer<
  typeof insertAccountDeletionRequestSchema
>;
export type AccountDeletionRequest =
  typeof accountDeletionRequests.$inferSelect;
export type InsertInstitutionalRequest = z.infer<
  typeof insertInstitutionalRequestSchema
>;
export type InstitutionalRequest = typeof institutionalRequests.$inferSelect;
