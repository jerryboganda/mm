import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function inspect() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query("SELECT id, email, role, is_active, is_email_verified, password FROM users");
  console.log("All users in DB:", rows);
  await conn.end();
}

inspect().catch(console.error);
