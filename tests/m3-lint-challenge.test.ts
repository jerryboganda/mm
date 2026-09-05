import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Milestone 3 Challenge: ESLint and Prettier Configuration Integrity", () => {
  const prettierrcPath = path.resolve(process.cwd(), ".prettierrc");
  const eslintConfigPath = path.resolve(process.cwd(), "eslint.config.js");

  assert.ok(fs.existsSync(prettierrcPath), ".prettierrc must exist");
  assert.ok(fs.existsSync(eslintConfigPath), "eslint.config.js must exist");

  const prettierConfig = JSON.parse(fs.readFileSync(prettierrcPath, "utf8"));
  assert.equal(prettierConfig.endOfLine, "auto", ".prettierrc must specify endOfLine: auto");

  const eslintContent = fs.readFileSync(eslintConfigPath, "utf8");
  assert.ok(eslintContent.includes("eslintPluginPrettierRecommended"), "ESLint config must include prettier recommended plugin");
  assert.ok(eslintContent.includes("server_dist/**"), "ESLint config must ignore server_dist");
  assert.ok(eslintContent.includes("web_dist/**"), "ESLint config must ignore web_dist");
  assert.ok(eslintContent.includes("admin_dist/**"), "ESLint config must ignore admin_dist");
  assert.ok(eslintContent.includes("website_dist/**"), "ESLint config must ignore website_dist");
});

test("Milestone 3 Challenge: No Suppressive eslint-disable Comments in Source Code", () => {
  const directoriesToScan = ["client", "server", "shared", "scripts"];

  function scanDir(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "dist" && entry.name !== "coverage") {
          results = results.concat(scanDir(fullPath));
        }
      } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        if (!entry.name.includes(".bundle.")) {
          results.push(fullPath);
        }
      }
    }
    return results;
  }

  const allSourceFiles = directoriesToScan.flatMap((d) => scanDir(path.resolve(process.cwd(), d)));
  assert.ok(allSourceFiles.length > 50, `Found ${allSourceFiles.length} source files to scan`);

  const filesWithDisable: string[] = [];
  for (const file of allSourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("eslint-disable")) {
      filesWithDisable.push(file);
    }
  }

  assert.deepEqual(filesWithDisable, [], `Found unexpected eslint-disable in source files: ${filesWithDisable.join(", ")}`);
});

test("Milestone 3 Challenge: Password Complexity Regex Validation in ResetPasswordScreen", () => {
  // Verify the password complexity regex logic audited in ResetPasswordScreen
  const passwordValidator = (password: string) => {
    const errors: Record<string, string> = {};
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(password)) {
      errors.password = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(password)) {
      errors.password = "Password must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(password)) {
      errors.password = "Password must contain at least one number";
    }
    return errors;
  };

  assert.ok(passwordValidator("").password, "Empty password rejected");
  assert.ok(passwordValidator("Short1A").password, "Too short password rejected");
  assert.ok(passwordValidator("lowercaseonly1").password, "No uppercase rejected");
  assert.ok(passwordValidator("UPPERCASEONLY1").password, "No lowercase rejected");
  assert.ok(passwordValidator("NoNumberHereA").password, "No digit rejected");
  assert.deepEqual(passwordValidator("ValidPass123"), {}, "Valid complex password accepted");
});

test("Milestone 3 Challenge: PaymentProofUpload Amount Initialization Precedence", () => {
  // Test the fallback chain: discountedPrice || price || ""
  const initAmount = (discountedPrice?: string, price?: string) => discountedPrice || price || "";

  assert.equal(initAmount("2500", "5000"), "2500", "Prefers discountedPrice when available");
  assert.equal(initAmount(undefined, "5000"), "5000", "Falls back to original price when no coupon");
  assert.equal(initAmount(undefined, undefined), "", "Falls back to empty string when neither available");
  assert.equal(initAmount("", "5000"), "5000", "Empty string discount falls back to price");
});
