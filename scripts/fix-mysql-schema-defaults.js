import fs from "fs";
import path from "path";

const schemaPath = path.join(process.cwd(), "shared", "schema.ts");
let content = fs.readFileSync(schemaPath, "utf-8");

// Add crypto import if missing
if (!content.includes('import crypto from "crypto";')) {
  content = `import crypto from "crypto";\n` + content;
}

// Replace id column definitions with $defaultFn
content = content.replace(
  /id: varchar\("id", \{ length: 36 \}\)\s*\n?\s*\.primaryKey\(\)\s*,?/g,
  'id: varchar("id", { length: 36 }).$defaultFn(() => crypto.randomUUID()).primaryKey(),'
);

fs.writeFileSync(schemaPath, content, "utf-8");
console.log("Updated schema id columns with $defaultFn successfully!");
