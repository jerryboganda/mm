import dotenv from "dotenv";
dotenv.config();

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { pgTable, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("student"),
  isActive: boolean("is_active").default(true).notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
});

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  const db = drizzle(pool);

  console.log("[1] Querying with Drizzle select().from(users)...");
  const result = await db.select().from(users).where(eq(users.email, "drfarzanamuneer1@gmail.com"));
  console.log("Result:", result);

  if (result.length > 0) {
    const u = result[0];
    const match = await bcrypt.compare("Admin@123456", u.password);
    console.log("Password matches:", match);
  }
  await pool.end();
}

main().catch(console.error);
