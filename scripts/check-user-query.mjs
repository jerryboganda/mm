import mysql from "mysql2/promise";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query(
    "SELECT * FROM users WHERE email = 'drfarzanamuneer1@gmail.com'",
  );
  console.log("Raw user row:", rows[0]);

  const match = await bcrypt.compare("Admin@123456", rows[0].password);
  console.log("Direct bcrypt match for 'Admin@123456':", match);

  // Check if Drizzle select works
  const { drizzle } = await import("drizzle-orm/mysql2");
  const { pgTable, text, varchar, boolean } = await import(
    "drizzle-orm/pg-core"
  );
  const { eq } = await import("drizzle-orm");

  const users = pgTable("users", {
    id: varchar("id").primaryKey(),
    email: text("email").notNull(),
    password: text("password").notNull(),
    role: text("role"),
    isActive: boolean("is_active"),
    isEmailVerified: boolean("is_email_verified"),
  });

  const db = drizzle(conn);
  const [drizzleUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "drfarzanamuneer1@gmail.com"));
  console.log("Drizzle query result:", drizzleUser);

  await conn.end();
}

check().catch(console.error);
