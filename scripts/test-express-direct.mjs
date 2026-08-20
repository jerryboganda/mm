import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";

async function main() {
  // Dynamically import the compiled server bundle
  const serverModule = await import("../server_dist/index.js");
  const app = serverModule.app || serverModule.default;

  console.log("[*] Testing Express dispatch directly...");
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1", async () => {
    const addr = server.address();
    const port = typeof addr === "object" ? addr.port : 0;
    console.log("[+] Test server listening on 127.0.0.1:" + port);

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "drfarzanamuneer1@gmail.com",
          password: "Admin@123456",
        }),
      });

      console.log("Direct Express Status:", res.status);
      const data = await res.json();
      console.log("Direct Express Response:", data);
    } catch (err) {
      console.error("Direct fetch error:", err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

main().catch(console.error);
