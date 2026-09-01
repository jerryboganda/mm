import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[-] DATABASE_URL is not set.");
  process.exit(1);
}

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(191) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'none',
    subscription_plan VARCHAR(100),
    subscription_expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verification_token VARCHAR(255),
    email_token_expires_at DATETIME,
    phone_number VARCHAR(50),
    is_phone_verified BOOLEAN NOT NULL DEFAULT false,
    phone_verification_token VARCHAR(50),
    phone_token_expires_at DATETIME,
    device_limit_override_enabled BOOLEAN NOT NULL DEFAULT false,
    device_limit_max INT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    device_label VARCHAR(255),
    platform VARCHAR(50),
    user_agent TEXT,
    ip_address VARCHAR(100),
    refresh_token_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    revoked_by VARCHAR(191),
    revoke_reason TEXT,
    INDEX idx_user_sessions_user_active (user_id, is_active),
    INDEX idx_user_sessions_device (user_id, device_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS books (
    id VARCHAR(191) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_published BOOLEAN DEFAULT false,
    \`order\` INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(191) PRIMARY KEY,
    book_id VARCHAR(191) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    \`order\` INT DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chapters_book_id (book_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS topics (
    id VARCHAR(191) PRIMARY KEY,
    chapter_id VARCHAR(191) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    \`order\` INT DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    author VARCHAR(255),
    source VARCHAR(255),
    \`references\` TEXT,
    last_reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_topics_chapter_id (chapter_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS content_blocks (
    id VARCHAR(191) PRIMARY KEY,
    topic_id VARCHAR(191) NOT NULL,
    type VARCHAR(50) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    \`order\` INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_content_blocks_topic_id (topic_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS mcqs (
    id VARCHAR(191) PRIMARY KEY,
    topic_id VARCHAR(191) NOT NULL,
    question TEXT NOT NULL,
    options JSON NOT NULL,
    correct_answer VARCHAR(255) NOT NULL,
    explanation TEXT,
    option_explanations JSON,
    difficulty VARCHAR(50) NOT NULL DEFAULT 'medium',
    \`references\` TEXT,
    tags JSON,
    is_published BOOLEAN DEFAULT false,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mcqs_topic_id (topic_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS user_progress (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    topic_id VARCHAR(191) NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confidence_level INT DEFAULT 0,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_progress_user_topic (user_id, topic_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS bookmarks (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    topic_id VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bookmarks_user_topic (user_id, topic_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS quiz_attempts (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    mcq_id VARCHAR(191) NOT NULL,
    selected_answer VARCHAR(255) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_spent_seconds INT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_quiz_attempts_user_mcq (user_id, mcq_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS recent_activity (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recent_activity_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS review_schedule (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    topic_id VARCHAR(191) NOT NULL,
    scheduled_for DATETIME NOT NULL,
    interval_days INT NOT NULL,
    ease_factor DECIMAL(5,2) NOT NULL,
    repetitions INT NOT NULL,
    last_reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_review_schedule_user (user_id, scheduled_for)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    \`key\` VARCHAR(191) PRIMARY KEY,
    value JSON NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(191) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_active BOOLEAN DEFAULT true,
    starts_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(191),
    changes JSON,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS content_reports (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    topic_id VARCHAR(191),
    mcq_id VARCHAR(191),
    report_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    resolved_by VARCHAR(191),
    resolved_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS subscription_packages (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    features JSON,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS package_prices (
    id VARCHAR(191) PRIMARY KEY,
    package_id VARCHAR(191) NOT NULL,
    duration_months INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'PKR',
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS package_features (
    id VARCHAR(191) PRIMARY KEY,
    package_id VARCHAR(191) NOT NULL,
    feature_key VARCHAR(100) NOT NULL,
    is_included BOOLEAN DEFAULT true,
    limit_value INT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS coupons (
    id VARCHAR(191) PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    discount_type VARCHAR(50) NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    max_uses INT,
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    package_id VARCHAR(191),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    cancelled_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_subscriptions_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS manual_payment_proofs (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    package_id VARCHAR(191),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255),
    proof_image_url TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reviewed_by VARCHAR(191),
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS waitlist_entries (
    id VARCHAR(191) PRIMARY KEY,
    email VARCHAR(191) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(100),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS newsletter_entries (
    id VARCHAR(191) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS contact_messages (
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(191) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unread',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
];

async function init() {
  console.log("[*] Connecting to MySQL to initialize tables...");
  const conn = await mysql.createConnection({
    uri: dbUrl,
    multipleStatements: true,
  });

  try {
    for (const ddl of DDL_STATEMENTS) {
      await conn.query(ddl);
    }
    console.log("[+] All MySQL schema tables verified/created successfully.");

    // Seed default admin if missing
    const [adminRows] = await conn.query(
      "SELECT id FROM users WHERE email = 'drfarzanamuneer1@gmail.com'",
    );
    if (!adminRows || adminRows.length === 0) {
      console.log("[*] Seeding default admin user...");
      const hashedPassword = await bcrypt.hash("Admin@123456", 10);
      await conn.query(
        "INSERT INTO users (id, email, password, name, role, is_email_verified) VALUES ('u-admin-01', 'drfarzanamuneer1@gmail.com', ?, 'Dr. Farzana Muneer', 'admin', true)",
        [hashedPassword],
      );
      console.log("[+] Default admin user created.");
    }

    // Seed books and topics topology from maternal_mind_book_mysql.sql if books are empty
    const [bookRows] = await conn.query("SELECT id FROM books LIMIT 1");
    if (!bookRows || bookRows.length === 0) {
      console.log("[*] Seeding 13 books and 285 topics topology...");
      const bookSqlPath = path.resolve(
        process.cwd(),
        "scripts/maternal_mind_book_mysql.sql",
      );
      if (fs.existsSync(bookSqlPath)) {
        const bookSql = fs.readFileSync(bookSqlPath, "utf-8");
        // Extract only books, chapters, and topics inserts
        const filteredLines = bookSql
          .split("\n")
          .filter(
            (line) =>
              line.startsWith("INSERT INTO books") ||
              line.startsWith("INSERT INTO chapters") ||
              line.startsWith("INSERT INTO topics"),
          );

        console.log(
          `[*] Inserting ${filteredLines.length} topology records...`,
        );
        for (const line of filteredLines) {
          if (line.trim()) {
            await conn.query(line);
          }
        }
        console.log(
          "[+] Topology (13 books, chapters, 285 topics) inserted successfully.",
        );
      }
    }
  } catch (err) {
    console.error("[-] Error initializing MySQL schema:", err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

init();
