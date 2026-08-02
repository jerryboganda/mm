import fs from "fs";
import path from "path";

const schemaPath = path.join(process.cwd(), "shared", "schema.ts");
let content = fs.readFileSync(schemaPath, "utf-8");

// Fix varchar("...") without options object
content = content.replace(/varchar\("([^"]+)"\)(?!\s*,\s*\{)/g, (match, col) => {
  const len = col === "id" || col.endsWith("Id") || col.endsWith("_id") ? 36 : 255;
  return `varchar("${col}", { length: ${len} })`;
});

// Clean up trailing commas before method calls
content = content.replace(/\.primaryKey\(\)\s*,\s*;/g, ".primaryKey();");

fs.writeFileSync(schemaPath, content, "utf-8");
console.log("Fixed MySQL varchar length parameters successfully!");
