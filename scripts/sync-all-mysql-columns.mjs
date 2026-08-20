import mysql from "mysql2/promise";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[-] DATABASE_URL is not set.");
  process.exit(1);
}

async function sync() {
  console.log("[*] Connecting to MySQL to synchronize all schema columns...");
  const conn = await mysql.createConnection(dbUrl);

  try {
    // 1. app_settings
    const [appSettingCols] = await conn.query("SHOW COLUMNS FROM app_settings");
    const appSettingColNames = appSettingCols.map((c) => c.Field);
    if (!appSettingColNames.includes("id")) {
      console.log("[*] Adding id column to app_settings...");
      await conn.query("ALTER TABLE app_settings ADD COLUMN id VARCHAR(191) NOT NULL DEFAULT (UUID()) FIRST");
    }

    // 2. users
    const [userCols] = await conn.query("SHOW COLUMNS FROM users");
    const userColNames = userCols.map((c) => c.Field);
    if (!userColNames.includes("is_active")) {
      await conn.query("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true");
    }
    if (!userColNames.includes("deletion_status")) {
      await conn.query("ALTER TABLE users ADD COLUMN deletion_status VARCHAR(50) NOT NULL DEFAULT 'none'");
    }
    if (!userColNames.includes("avatar_url")) {
      await conn.query("ALTER TABLE users ADD COLUMN avatar_url TEXT");
    }
    if (!userColNames.includes("deactivated_at")) {
      await conn.query("ALTER TABLE users ADD COLUMN deactivated_at DATETIME");
    }
    if (!userColNames.includes("deactivation_reason")) {
      await conn.query("ALTER TABLE users ADD COLUMN deactivation_reason TEXT");
    }
    if (!userColNames.includes("deletion_requested_at")) {
      await conn.query("ALTER TABLE users ADD COLUMN deletion_requested_at DATETIME");
    }

    // 3. user_progress
    const [progressCols] = await conn.query("SHOW COLUMNS FROM user_progress");
    const progressColNames = progressCols.map((c) => c.Field);
    if (!progressColNames.includes("completed_at")) {
      console.log("[*] Adding completed_at column to user_progress...");
      await conn.query("ALTER TABLE user_progress ADD COLUMN completed_at DATETIME");
    }
    if (!progressColNames.includes("is_completed")) {
      await conn.query("ALTER TABLE user_progress ADD COLUMN is_completed BOOLEAN DEFAULT false");
    }

    // 4. topics
    const [topicCols] = await conn.query("SHOW COLUMNS FROM topics");
    const topicColNames = topicCols.map((c) => c.Field);
    if (!topicColNames.includes("is_paid")) {
      console.log("[*] Adding is_paid column to topics...");
      await conn.query("ALTER TABLE topics ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false");
    }
    if (!topicColNames.includes("last_reviewed_at")) {
      await conn.query("ALTER TABLE topics ADD COLUMN last_reviewed_at DATETIME");
    }
    if (!topicColNames.includes("author")) {
      await conn.query("ALTER TABLE topics ADD COLUMN author TEXT");
    }
    if (!topicColNames.includes("source")) {
      await conn.query("ALTER TABLE topics ADD COLUMN source TEXT");
    }
    if (!topicColNames.includes("references")) {
      await conn.query("ALTER TABLE topics ADD COLUMN `references` TEXT");
    }

    // 6. recent_activity
    try {
      const [activityCols] = await conn.query("SHOW COLUMNS FROM recent_activity");
      const activityColNames = activityCols.map((c) => c.Field);
      if (!activityColNames.includes("topic_id")) {
        console.log("[*] Adding topic_id column to recent_activity...");
        await conn.query("ALTER TABLE recent_activity ADD COLUMN topic_id VARCHAR(191)");
      }
      if (!activityColNames.includes("viewed_at")) {
        console.log("[*] Adding viewed_at column to recent_activity...");
        await conn.query("ALTER TABLE recent_activity ADD COLUMN viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
      }
    } catch (e) {}

    // 4. Ensure student@maternalmind.app also has password Password@123
    const studentAppHash = await bcrypt.hash("Password@123", 10);
    await conn.query(`
      INSERT INTO users (id, email, password, name, role, is_active, is_email_verified, deletion_status)
      VALUES ('u-student-02', 'student@maternalmind.app', ?, 'Medical Student App', 'student', 1, 1, 'none')
      ON DUPLICATE KEY UPDATE password = VALUES(password), is_active = 1, is_email_verified = 1, role = 'student', deletion_status = 'none'
    `, [studentAppHash]);

    // 3. Ensure admin and student users are verified & active
    const adminHash = await bcrypt.hash("Admin@123456", 10);
    await conn.query(`
      INSERT INTO users (id, email, password, name, role, is_active, is_email_verified, deletion_status)
      VALUES ('u-admin-01', 'drfarzanamuneer1@gmail.com', ?, 'Dr. Farzana Muneer', 'admin', 1, 1, 'none')
      ON DUPLICATE KEY UPDATE password = VALUES(password), is_active = 1, is_email_verified = 1, role = 'admin', deletion_status = 'none'
    `, [adminHash]);

    const studentHash = await bcrypt.hash("Password@123", 10);
    await conn.query(`
      INSERT INTO users (id, email, password, name, role, is_active, is_email_verified, deletion_status)
      VALUES ('u-student-01', 'student@maternalmind.com', ?, 'Medical Student', 'student', 1, 1, 'none')
      ON DUPLICATE KEY UPDATE password = VALUES(password), is_active = 1, is_email_verified = 1, role = 'student', deletion_status = 'none'
    `, [studentHash]);

    await conn.query("UPDATE users SET is_email_verified = 1, is_active = 1, deletion_status = 'none'");

    console.log("[+] All MySQL schema columns synchronized successfully!");
  } catch (err) {
    console.error("[-] Error syncing columns:", err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

sync();
