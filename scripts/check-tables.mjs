import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [tables] = await conn.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);
  for (const t of tableNames) {
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${t}\``);
    console.log(t, cols.map((c) => c.Field).join(", "));
  }
  await conn.end();
}
check().catch(console.error);
