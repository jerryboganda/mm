import fs from "fs";
import path from "path";

function refactorFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");

  // Ensure crypto import exists
  if (!content.includes('import crypto from "crypto";')) {
    content = `import crypto from "crypto";\n` + content;
  }

  // Replace [var] = await db.insert(table).values(data).returning();
  content = content.replace(
    /const\s+\[([^\]]+)\]\s*=\s*await\s+db\s*\n?\s*\.insert\(([^)]+)\)\s*\n?\s*\.values\(([^)]+)\)\s*\n?\s*\.returning\(\);/g,
    (match, varName, table, valuesVar) => {
      return `const __id = (${valuesVar} as any).id || crypto.randomUUID();\n  const ${varName} = { id: __id, ...${valuesVar} };\n  await db.insert(${table}).values(${varName} as any);`;
    }
  );

  // Replace [var] = await db.update(table).set(data).where(...).returning();
  content = content.replace(
    /const\s+\[([^\]]+)\]\s*=\s*await\s+db\s*\n?\s*\.update\(([^)]+)\)\s*\n?\s*\.set\(([^)]+)\)\s*\n?\s*\.where\(([^)]+)\)\s*\n?\s*\.returning\(\);/g,
    (match, varName, table, setData, whereCond) => {
      return `await db.update(${table}).set(${setData}).where(${whereCond});\n  const [${varName}] = await db.select().from(${table}).where(${whereCond});`;
    }
  );

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`Refactored ${path.relative(process.cwd(), filePath)} for MySQL`);
}

const targetFiles = [
  "server/storage.ts",
  "server/admin-storage.ts",
  "server/routes/admin-manual-payments.ts",
  "server/routes/admin-subscriptions.ts",
  "server/routes/subscription.ts",
  "server/services/subscription-service.ts",
  "server/services/coupon-service.ts",
  "server/services/payment-gateway.ts",
  "server/lib/device-sessions.ts"
];

for (const file of targetFiles) {
  refactorFile(path.join(process.cwd(), file));
}
