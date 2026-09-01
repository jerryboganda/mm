import dotenv from "dotenv";

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
dotenv.config();

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  const db = drizzle(pool);

  console.log("[*] Querying users using shared/schema.ts table definition...");
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, "drfarzanamuneer1@gmail.com"));
    console.log("[+] Result:", result);
    if (result.length > 0) {
      const match = await bcrypt.compare("Admin@123456", result[0].password);
      console.log("[+] Password match:", match);
    }
  } catch (err) {
    console.error("[-] Drizzle query failed:", err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
