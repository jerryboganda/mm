import fs from "fs";
import path from "path";

function convertFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");

  if (!content.includes(".returning()")) return;

  // Add crypto import if needed
  if (!content.includes("crypto")) {
    content = `import crypto from "crypto";\n` + content;
  }

  // Replace returning pattern in update/insert
  content = content.replace(/\.returning\(\);?/g, ";");

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(
    `Converted returning() in ${path.relative(process.cwd(), filePath)}`,
  );
}

const files = [
  "server/admin-storage.ts",
  "server/lib/device-sessions.ts",
  "server/routes/admin-manual-payments.ts",
  "server/routes/admin-subscriptions.ts",
  "server/routes/subscription.ts",
  "server/services/coupon-service.ts",
  "server/services/payment-gateway.ts",
  "server/services/subscription-service.ts",
];

for (const file of files) {
  convertFile(path.join(process.cwd(), file));
}
