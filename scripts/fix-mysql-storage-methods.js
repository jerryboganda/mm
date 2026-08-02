import fs from "fs";
import path from "path";

const storagePath = path.join(process.cwd(), "server", "storage.ts");
let content = fs.readFileSync(storagePath, "utf-8");

// Fix createUser
content = content.replace(
  /async createUser\(insertUser: InsertUser\): Promise<User> \{[^}]+\}/s,
  `async createUser(insertUser: InsertUser): Promise<User> {
    const id = insertUser.id || crypto.randomUUID();
    await db.insert(users).values({ ...insertUser, id });
    const user = await this.getUser(id);
    return user!;
  }`
);

// Fix createQuizAttempt
content = content.replace(
  /async createQuizAttempt\([^)]+\): Promise<QuizAttempt> \{[^}]+\}/s,
  `async createQuizAttempt(insertAttempt: Omit<QuizAttempt, "id" | "createdAt">): Promise<QuizAttempt> {
    const id = crypto.randomUUID();
    await db.insert(quizAttempts).values({ ...insertAttempt, id });
    const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, id));
    return attempt;
  }`
);

// Fix updateUserProfile
content = content.replace(
  /async updateUserProfile\([^)]+\): Promise<User \| undefined> \{[^}]+\}/s,
  `async updateUserProfile(userId: string, data: { name: string; avatarUrl?: string | null }): Promise<User | undefined> {
    await db.update(users).set(data).where(eq(users.id, userId));
    return this.getUser(userId);
  }`
);

// Fix updateSubscription
content = content.replace(
  /async updateSubscription\([^)]+\): Promise<User \| undefined> \{[^}]+\}/s,
  `async updateSubscription(userId: string, data: { subscriptionStatus: string; subscriptionPlan?: string; subscriptionExpiresAt?: Date | null }): Promise<User | undefined> {
    await db.update(users).set(data).where(eq(users.id, userId));
    return this.getUser(userId);
  }`
);

// Fix deactivateUser
content = content.replace(
  /async deactivateUser\([^)]+\): Promise<User \| undefined> \{[^}]+\}/s,
  `async deactivateUser(userId: string, reason?: string): Promise<User | undefined> {
    await db.update(users).set({ isActive: false, deactivatedAt: new Date(), deactivationReason: reason }).where(eq(users.id, userId));
    return this.getUser(userId);
  }`
);

// Fix requestAccountDeletion
content = content.replace(
  /async requestAccountDeletion\([^)]+\): Promise<User \| undefined> \{[^}]+\}/s,
  `async requestAccountDeletion(userId: string, note?: string): Promise<User | undefined> {
    await db.update(users).set({ accountDeletionStatus: "requested", accountDeletionRequestedAt: new Date(), accountDeletionNote: note }).where(eq(users.id, userId));
    return this.getUser(userId);
  }`
);

// Fix updateUserVerification
content = content.replace(
  /async updateUserVerification\([^)]+\): Promise<User \| undefined> \{[^}]+\}/s,
  `async updateUserVerification(userId: string, data: { isEmailVerified?: boolean; emailVerificationToken?: string | null; emailTokenExpiresAt?: Date | null }): Promise<User | undefined> {
    await db.update(users).set(data).where(eq(users.id, userId));
    return this.getUser(userId);
  }`
);

fs.writeFileSync(storagePath, content, "utf-8");
console.log("Updated storage.ts MySQL methods successfully!");
