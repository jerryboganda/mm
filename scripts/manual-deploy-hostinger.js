import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("==========================================");
console.log("  MANUAL HOSTINGER DEPLOYMENT TRIGGER ");
console.log("==========================================");

// Read .env or environment variable for Webhook URL if present
let webhookUrl = process.env.HOSTINGER_WEBHOOK_URL || "";

if (!webhookUrl) {
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/HOSTINGER_WEBHOOK_URL\s*=\s*(.*)/);
    if (match && match[1]) {
      webhookUrl = match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
}

if (!webhookUrl) {
  console.log("\n📌 [INFO] Manual Hostinger Deployment Instructions:\n");
  console.log("1. GitHub Actions Manual Trigger (Recommended):");
  console.log("   - Open https://github.com/jerryboganda/mm/actions");
  console.log("   - Select 'Manual Deploy to Hostinger'");
  console.log("   - Click 'Run workflow' -> Choose 'all', 'website', or 'app_and_admin'\n");

  console.log("2. Hostinger hPanel Manual Deploy Button:");
  console.log("   - Log in to Hostinger hPanel -> Go to Git / Deployment tab");
  console.log("   - Click the 'Deploy' button manually whenever you are ready to publish.\n");

  console.log("3. Hostinger Git Webhook Trigger:");
  console.log("   - Copy your Webhook URL from Hostinger hPanel > Git > Deployments.");
  console.log("   - Add it to your local .env file as: HOSTINGER_WEBHOOK_URL=https://...");
  console.log("   - Re-run `npm run deploy:hostinger` to trigger deployment instantly.\n");
  process.exit(0);
}

console.log(`Sending manual deployment trigger to Hostinger...`);
console.log(`Target Webhook: ${webhookUrl}`);

const client = webhookUrl.startsWith("https") ? https : http;

const req = client.request(webhookUrl, { method: "POST" }, (res) => {
  console.log(`Hostinger Response Status: ${res.statusCode} ${res.statusMessage}`);
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    console.log(`Hostinger Response Body:\n${body}`);
    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
      console.log("\n✅ Manual Hostinger Deployment Successfully Triggered!");
    } else {
      console.log("\n⚠️ Hostinger returned a non-200 status code. Please check your Webhook URL in hPanel.");
    }
  });
});

req.on("error", (err) => {
  console.error("❌ Failed to trigger Hostinger Webhook:", err.message);
});

req.end();
