import dotenv from "dotenv";
dotenv.config();

import { storage } from "../server/storage.js";
import bcrypt from "bcryptjs";

async function main() {
  console.log("[*] Testing storage.getUserByEmail with storage singleton...");
  try {
    const user = await storage.getUserByEmail("drfarzanamuneer1@gmail.com");
    console.log("User from storage:", user);
    if (user) {
      console.log("Password hash in DB:", user.password);
      const match = await bcrypt.compare("Admin@123456", user.password);
      console.log("bcrypt.compare match:", match);
    } else {
      console.log("[-] User NOT FOUND by storage.getUserByEmail");
    }
  } catch (err) {
    console.error("[-] storage.getUserByEmail threw error:", err);
  }
}

main().catch(console.error);
