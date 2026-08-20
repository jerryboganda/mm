import dotenv from "dotenv";
dotenv.config();

import { storage } from "../server/storage.js";
import bcrypt from "bcryptjs";

async function test() {
  console.log("[*] Testing storage.getUserByEmail...");
  try {
    const user = await storage.getUserByEmail("drfarzanamuneer1@gmail.com");
    console.log("User retrieved from storage:", user);
    if (user) {
      const match = await bcrypt.compare("Admin@123456", user.password);
      console.log("Password compare:", match);
    }
  } catch (err) {
    console.error("Storage error:", err);
  }
}

test();
