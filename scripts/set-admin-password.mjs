import mysql from "mysql2/promise";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const hash = await bcrypt.hash("Admin@123456", 10);
  await conn.query(
    "UPDATE users SET password = ?, is_active = 1, is_email_verified = 1 WHERE email = 'drfarzanamuneer1@gmail.com'",
    [hash]
  );
  console.log("SUCCESS! Admin password updated to Admin@123456 and verified.");
  await conn.end();
}

main().catch(console.error);
