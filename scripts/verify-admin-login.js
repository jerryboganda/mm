import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgres://maternal_mind:32a87fd0fc74c9b95c999b5a44623e207dfa3843@127.0.0.1:15432/maternal_mind",
});

async function main() {
  const result = await pool.query(
    "SELECT id, email, password, role FROM users WHERE email = $1",
    ["demo@maternalmind.app"]
  );
  const user = result.rows[0];
  const isPasswordValid = await bcrypt.compare("Demo@123", user.password);
  console.log("LOGIN VERIFICATION TEST:");
  console.log("Email:", user.email);
  console.log("Role:", user.role);
  console.log("Password valid (Demo@123):", isPasswordValid);
  await pool.end();
}

main().catch(console.error);
