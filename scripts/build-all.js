import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const rootDir = process.cwd();

function log(msg) {
  console.log(`\x1b[36m[BUILD-ALL]\x1b[0m ${msg}`);
}

function run(cmd, cwd = rootDir) {
  log(`Executing: ${cmd} (in ${path.relative(rootDir, cwd) || "."})`);
  execSync(cmd, { stdio: "inherit", cwd });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  log("Starting Unified Single-Slot Build for Maternal Mind...");

  // 1. Build Admin Panel SPA
  const adminDir = path.join(rootDir, "admin");
  if (fs.existsSync(adminDir)) {
    log("Building Admin Panel SPA...");
    if (!fs.existsSync(path.join(adminDir, "node_modules"))) {
      log("Installing dependencies in admin/...");
      run("npm install --no-audit --no-fund", adminDir);
    }
    run("npm run build", adminDir);
  }

  // 2. Build Marketing Website SPA
  const websiteDir = path.join(rootDir, "Maternal Mind Website");
  if (fs.existsSync(websiteDir)) {
    log("Building Marketing Website SPA...");
    if (!fs.existsSync(path.join(websiteDir, "node_modules"))) {
      log("Installing dependencies in Maternal Mind Website/...");
      run("npm install --no-audit --no-fund", websiteDir);
    }
    run("npx vite build", websiteDir);
    const websiteViteOutput = path.join(websiteDir, "dist", "public");
    const targetWebsiteDist = path.join(rootDir, "website_dist");
    if (fs.existsSync(websiteViteOutput)) {
      log(`Copying website output to ${targetWebsiteDist}...`);
      if (fs.existsSync(targetWebsiteDist)) {
        fs.rmSync(targetWebsiteDist, { recursive: true, force: true });
      }
      copyDir(websiteViteOutput, targetWebsiteDist);
    }
  }

  // 3. Build Expo Mobile Web SPA
  log("Exporting Expo Mobile Web...");
  run("npm run expo:web:build");

  // 4. Build Server bundle
  log("Building Server Bundle via esbuild...");
  run("npm run server:build");

  log(
    "\x1b[32m[BUILD-ALL SUCCESS]\x1b[0m All frontends (website_dist, admin_dist, web_dist) & server (server_dist) built successfully for Single-Slot deployment!",
  );
} catch (err) {
  console.error("\x1b[31m[BUILD-ALL ERROR]\x1b[0m Build failed:", err.message);
  process.exit(1);
}
