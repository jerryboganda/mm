import { spawn } from "child_process";

const VPS_IP = "185.252.233.186";
const VPS_USER = "root";
const PROJECT_DIR = "/opt/docker/maternal-mind";

console.log("==========================================");
console.log(`  DEPLOY TO PRODUCTION VPS (${VPS_IP})   `);
console.log("==========================================");

const remoteCmd = `cd ${PROJECT_DIR} && git pull origin main && docker compose build app && docker compose up -d --force-recreate app && sleep 4 && curl -s http://127.0.0.1:5000/health`;

console.log(`Executing SSH deploy command on ${VPS_USER}@${VPS_IP}...`);

const ssh = spawn("ssh", [
  "-o", "BatchMode=yes",
  "-o", "StrictHostKeyChecking=no",
  `${VPS_USER}@${VPS_IP}`,
  remoteCmd,
], { stdio: "inherit" });

ssh.on("close", (code) => {
  if (code === 0) {
    console.log("\n==========================================");
    console.log(`✅ Production VPS (${VPS_IP}) Deployment Successful!`);
    console.log("==========================================");
  } else {
    console.error(`\n❌ Deployment failed with exit code ${code}`);
    process.exit(code || 1);
  }
});
