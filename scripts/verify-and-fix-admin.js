import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString:
    "postgres://maternal_mind:32a87fd0fc74c9b95c999b5a44623e207dfa3843@127.0.0.1:15432/maternal_mind",
});

async function main() {
  const result = await pool.query(
    "UPDATE users SET is_email_verified = true, role = 'admin', is_active = true WHERE email = $1 RETURNING id, email, role, is_email_verified",
    ["demo@maternalmind.app"],
  );
  console.log("ADMIN USER FIXED & VERIFIED:", result.rows);
  await pool.end();
}

main().catch(console.error);
