import fs from "fs";
import path from "path";

const schemaPath = path.join(process.cwd(), "shared", "schema.ts");
let content = fs.readFileSync(schemaPath, "utf-8");

// 1. Change imports
content = content.replace(
  /from "drizzle-orm\/pg-core";/g,
  'from "drizzle-orm/mysql-core";'
);
content = content.replace(/\bpgTable\b/g, "mysqlTable");
content = content.replace(/\binteger\b/g, "int");
content = content.replace(/\bnumeric\b/g, "decimal");
content = content.replace(/\bjsonb\b/g, "json");
content = content.replace(/\.default\(sql`gen_random_uuid\(\)`\)/g, "");

fs.writeFileSync(schemaPath, content, "utf-8");
console.log("Schema converted to Drizzle MySQL successfully!");
