import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgres://maternal_mind:32a87fd0fc74c9b95c999b5a44623e207dfa3843@127.0.0.1:15432/maternal_mind",
});

async function main() {
  const hash = await bcrypt.hash("Demo@123", 10);
  const result = await pool.query(
    "UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, role",
    [hash, "demo@maternalmind.app"]
  );
  console.log("SUCCESS! Admin credentials updated:", result.rows);
  await pool.end();
}

main().catch(console.error);
