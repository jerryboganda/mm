import fs from "fs";
import path from "path";

const pgDumpPath = path.join(process.cwd(), "maternal_mind_final_backup.sql");
const mysqlDumpPath = path.join(
  process.cwd(),
  "scripts",
  "maternal_mind_mysql.sql",
);

if (!fs.existsSync(pgDumpPath)) {
  console.error("PostgreSQL dump file missing!");
  process.exit(1);
}

let dump = fs.readFileSync(pgDumpPath, "utf-8");

// Convert PG dump syntax to MySQL syntax
let mysqlDump = dump
  .replace(/SET [^;]+;/gi, "")
  .replace(/SELECT pg_catalog\.[^;]+;/gi, "")
  .replace(/CREATE EXTENSION [^;]+;/gi, "")
  .replace(/COMMENT ON [^;]+;/gi, "")
  .replace(/ALTER TABLE ONLY [^;]+;/gi, "")
  .replace(/CREATE INDEX [^;]+;/gi, "")
  .replace(/CREATE UNIQUE INDEX [^;]+;/gi, "")
  .replace(/boolean DEFAULT (true|false)/gi, "tinyint(1) DEFAULT $1")
  .replace(/true/g, "1")
  .replace(/false/g, "0")
  .replace(/timestamp without time zone/gi, "datetime")
  .replace(/timestamp with time zone/gi, "datetime")
  .replace(/character varying/gi, "varchar")
  .replace(/jsonb/gi, "json")
  .replace(/integer/gi, "int")
  .replace(/numeric\([^)]+\)/gi, "decimal(12,2)")
  .replace(/public\./g, "");

// Ensure SET FOREIGN_KEY_CHECKS=0 at top
mysqlDump =
  `SET FOREIGN_KEY_CHECKS = 0;\n` +
  mysqlDump +
  `\nSET FOREIGN_KEY_CHECKS = 1;\n`;

fs.writeFileSync(mysqlDumpPath, mysqlDump, "utf-8");
console.log(
  "Converted PostgreSQL dump to MySQL dump successfully at scripts/maternal_mind_mysql.sql!",
);
