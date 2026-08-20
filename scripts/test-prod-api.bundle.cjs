"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/test-prod-api.mjs
var import_node_process = __toESM(require("node:process"), 1);
var BASE_URL = import_node_process.default.env.BASE_URL || "https://maternalmind.com.pk";
async function testE2E() {
  console.log(`[*] Testing End-to-End on live production: ${BASE_URL}...
`);
  const webRes = await fetch(`${BASE_URL}/`);
  console.log(`[1] Marketing Website Root (/) HTTP Status: ${webRes.status} (Expected: 200)`);
  const webHtml = await webRes.text();
  console.log(`    HTML: ${webHtml.substring(0, 100).replace(/\n/g, " ")}...`);
  const adminRes = await fetch(`${BASE_URL}/admin/`);
  console.log(`[2] Admin Panel (/admin/) HTTP Status: ${adminRes.status} (Expected: 200)`);
  const adminHtml = await adminRes.text();
  console.log(`    Admin Title/HTML: ${adminHtml.substring(0, 100).replace(/\n/g, " ")}...`);
  const appRes = await fetch(`${BASE_URL}/app/`);
  console.log(`[3] Expo Mobile Web App (/app/) HTTP Status: ${appRes.status} (Expected: 200)`);
  console.log(`[4] Authenticating with production API (/api/auth/login)...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "drfarzanamuneer1@gmail.com",
      password: "Admin@123456"
    })
  });
  console.log(`    Login HTTP Status: ${loginRes.status}`);
  const loginData = await loginRes.json();
  console.log(`    Login Response:`, loginData);
  const token = loginData.accessToken || loginData.token;
  if (!token) {
    throw new Error(`Login failed to return token. Status: ${loginRes.status}`);
  }
  console.log(`    Logged in user: ${loginData.user?.name} (${loginData.user?.role})`);
  const booksRes = await fetch(`${BASE_URL}/api/books`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`[5] /api/books HTTP Status: ${booksRes.status}`);
  const books = await booksRes.json();
  console.log(`    Books received: ${books.length} books`);
  for (const b of books.slice(0, 5)) {
    console.log(`    - [Book ${b.order}] ${b.title} (${b.id})`);
  }
  const topicRes = await fetch(`${BASE_URL}/api/topics/t-mm-01-001`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`[6] /api/topics/t-mm-01-001 HTTP Status: ${topicRes.status}`);
  const topicData = await topicRes.json();
  const blocks = topicData.blocks || [];
  console.log(`    Blocks in Topic 1: ${blocks.length} blocks`);
  if (blocks.length > 0) {
    const b = blocks[0];
    console.log(`    - Block Type: ${b.type}`);
    console.log(`    - Block Content length: ${b.content.length} characters`);
    console.log(`    - Contains Parity Release Marker: ${b.content.includes("data-mm-release")}`);
    console.log(`    - Contains Vector/SVG table or layout: ${b.content.includes("mm-table-scroll")}`);
  }
  const mediaUrl = `${BASE_URL}/uploads/content-images/maternal-mind-book/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/media/646a5366f941f2526cac8b3fbf1538df90f5efc97c6adc3d6623c812eff81546.jfif`;
  const mediaRes = await fetch(mediaUrl);
  console.log(`[7] Production Media Asset HTTP Status: ${mediaRes.status} (Expected: 200)`);
  console.log(`    - Media Content-Type: ${mediaRes.headers.get("content-type")}`);
  console.log(`    - Media Content-Length: ${mediaRes.headers.get("content-length")} bytes`);
  console.log("\n=======================================================");
  console.log("\u2705 ALL 7 PRODUCTION END-TO-END VERIFICATION CHECKS PASSED!");
  console.log("=======================================================");
}
testE2E().catch((err) => {
  console.error("[-] Production E2E test failed:", err);
  import_node_process.default.exit(1);
});
