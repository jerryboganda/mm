import fs from "fs";
import path from "path";

const filePath = path.resolve(
  process.cwd(),
  "server/services/subscription-service.ts",
);
let content = fs.readFileSync(filePath, "utf-8");

// Replace pattern 1: const [varName] = await db.insert(...) ;
// Replace with: await db.insert(...) ;

// We need to carefully handle array destructuring of Drizzle insert/update calls in MySQL.
// In MySQL, db.insert(...) returns [ResultSetHeader], not [Row].
// Same for db.update(...).

content = content.replace(
  /const\s+\[([a-zA-Z0-9_]+)\]\s*=\s*await\s+db\s*\n?\s*\.insert\(/g,
  "await db.insert(",
);
content = content.replace(
  /const\s+\[([a-zA-Z0-9_]+)\]\s*=\s*await\s+db\s*\n?\s*\.update\(/g,
  "await db.update(",
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Processed subscription-service.ts");
