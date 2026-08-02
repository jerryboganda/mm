import fs from "fs";
import path from "path";

const dumpPath = path.join(process.cwd(), "maternal_mind_final_backup.sql");
const content = fs.readFileSync(dumpPath, "utf-8");

const lines = content.split("\n");
let currentTable = null;
const tableCounts = {};

for (let line of lines) {
  if (line.startsWith("COPY public.")) {
    const match = line.match(/^COPY public\.([^\s(]+)/);
    if (match) {
      currentTable = match[1];
      tableCounts[currentTable] = 0;
    }
  } else if (line.trim() === "\\.") {
    currentTable = null;
  } else if (currentTable && line.trim().length > 0) {
    tableCounts[currentTable]++;
  }
}

console.log("=== MISSION CRITICAL DATABASE AUDIT ===");
console.log(`Total Tables Audited: ${Object.keys(tableCounts).length}`);
let totalRows = 0;
for (const [table, count] of Object.entries(tableCounts)) {
  console.log(`  - Table '${table}': ${count} rows`);
  totalRows += count;
}
console.log(`Total Rows Preserved Across All Tables: ${totalRows}`);
