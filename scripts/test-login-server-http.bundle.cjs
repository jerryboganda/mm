"use strict";

// scripts/test-login-server-http.mjs
async function testLogin(email, password) {
  const res = await fetch("https://maternalmind.com.pk/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  console.log(`[${email}] Status:`, res.status);
  const data = await res.json();
  console.log(`[${email}] Data:`, data);
}
async function main() {
  await testLogin("drfarzanamuneer1@gmail.com", "Admin@123456");
  await testLogin("student@maternalmind.app", "Password@123");
}
main().catch(console.error);
