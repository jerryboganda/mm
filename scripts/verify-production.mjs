import mysql from "mysql2/promise";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

async function verify() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Ensure all users columns exist
  const [cols] = await conn.query("SHOW COLUMNS FROM users");
  const colNames = cols.map((c) => c.Field);

  if (!colNames.includes("is_active")) {
    await conn.query(
      "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true",
    );
  }
  if (!colNames.includes("deletion_status")) {
    await conn.query(
      "ALTER TABLE users ADD COLUMN deletion_status VARCHAR(50) NOT NULL DEFAULT 'none'",
    );
  }
  if (!colNames.includes("avatar_url")) {
    await conn.query("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  }
  if (!colNames.includes("deactivated_at")) {
    await conn.query("ALTER TABLE users ADD COLUMN deactivated_at DATETIME");
  }
  if (!colNames.includes("deactivation_reason")) {
    await conn.query("ALTER TABLE users ADD COLUMN deactivation_reason TEXT");
  }
  if (!colNames.includes("deletion_requested_at")) {
    await conn.query(
      "ALTER TABLE users ADD COLUMN deletion_requested_at DATETIME",
    );
  }

  // Ensure admin user is properly set
  const adminHash = await bcrypt.hash("Admin@123456", 10);
  await conn.query(
    `
    INSERT INTO users (id, email, password, name, role, is_active, is_email_verified, deletion_status)
    VALUES ('u-admin-01', 'drfarzanamuneer1@gmail.com', ?, 'Dr. Farzana Muneer', 'admin', 1, 1, 'none')
    ON DUPLICATE KEY UPDATE password = VALUES(password), is_active = 1, is_email_verified = 1, role = 'admin', deletion_status = 'none'
  `,
    [adminHash],
  );

  // Ensure all users are active & verified
  await conn.query(
    "UPDATE users SET is_email_verified = 1, is_active = 1, deletion_status = 'none'",
  );

  const [books] = await conn.query("SELECT count(*) as c FROM books");
  const [chapters] = await conn.query("SELECT count(*) as c FROM chapters");
  const [topics] = await conn.query("SELECT count(*) as c FROM topics");
  const [blocks] = await conn.query("SELECT count(*) as c FROM content_blocks");
  const [docBlocks] = await conn.query(
    "SELECT count(*) as c FROM content_blocks WHERE type = 'document_html'",
  );
  const [users] = await conn.query("SELECT count(*) as c FROM users");

  // Sample check topic 1 content
  const [sampleBlock] = await conn.query(
    "SELECT content FROM content_blocks WHERE topic_id = 't-mm-01-001' LIMIT 1",
  );
  const hasReleaseMarker =
    sampleBlock.length > 0 &&
    sampleBlock[0].content.includes(
      'data-mm-release="f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605"',
    );

  console.log("=== PRODUCTION DATABASE VERIFICATION ===");
  console.log(`Books: ${books[0].c}`);
  console.log(`Chapters: ${chapters[0].c}`);
  console.log(`Topics: ${topics[0].c}`);
  console.log(`Total Content Blocks: ${blocks[0].c}`);
  console.log(`Document HTML Blocks: ${docBlocks[0].c}`);
  console.log(`Users: ${users[0].c}`);
  console.log(
    `Sample Topic t-mm-01-001 Release Marker Verified: ${hasReleaseMarker}`,
  );
  console.log("=========================================");

  await conn.end();
}

verify().catch(console.error);
