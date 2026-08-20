import dotenv from "dotenv";
dotenv.config();

import { storage } from "../server/storage.js";
import bcrypt from "bcryptjs";

async function main() {
  console.log("[*] Testing login logic from within server environment...");
  const email = "drfarzanamuneer1@gmail.com";
  const password = "Admin@123456";

  const user = await storage.getUserByEmail(email);
  console.log("User retrieved by storage.getUserByEmail:", user ? { id: user.id, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, isActive: user.isActive } : null);

  if (!user) {
    console.log("[-] User is undefined/null!");
    return;
  }

  const validPassword = await bcrypt.compare(password, user.password);
  console.log("bcrypt.compare validPassword:", validPassword);

  if (!user.isEmailVerified) {
    console.log("[-] user.isEmailVerified is falsy:", user.isEmailVerified);
  }
}

main().catch(console.error);
