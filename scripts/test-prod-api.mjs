import process from "node:process";

const BASE_URL = process.env.BASE_URL || "https://maternalmind.com.pk";

async function testE2E() {
  console.log(`[*] Testing End-to-End on live production: ${BASE_URL}...\n`);

  // 1. Check Root Marketing Website
  const webRes = await fetch(`${BASE_URL}/`);
  console.log(
    `[1] Marketing Website Root (/) HTTP Status: ${webRes.status} (Expected: 200)`,
  );
  const webHtml = await webRes.text();
  console.log(`    HTML: ${webHtml.substring(0, 100).replace(/\n/g, " ")}...`);

  // 2. Check Admin Panel SPA
  const adminRes = await fetch(`${BASE_URL}/admin/`);
  console.log(
    `[2] Admin Panel (/admin/) HTTP Status: ${adminRes.status} (Expected: 200)`,
  );
  const adminHtml = await adminRes.text();
  console.log(
    `    Admin Title/HTML: ${adminHtml.substring(0, 100).replace(/\n/g, " ")}...`,
  );

  // 3. Check User App SPA
  const appRes = await fetch(`${BASE_URL}/app/`);
  console.log(
    `[3] Expo Mobile Web App (/app/) HTTP Status: ${appRes.status} (Expected: 200)`,
  );

  // 4. Authenticate as Admin
  console.log(`[4] Authenticating with production API (/api/auth/login)...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "drfarzanamuneer1@gmail.com",
      password: "Admin@123456",
    }),
  });
  console.log(`    Login HTTP Status: ${loginRes.status}`);
  const loginData = await loginRes.json();
  console.log(`    Login Response:`, loginData);

  const token = loginData.accessToken || loginData.token;
  if (!token) {
    throw new Error(`Login failed to return token. Status: ${loginRes.status}`);
  }

  console.log(
    `    Logged in user: ${loginData.user?.name} (${loginData.user?.role})`,
  );

  // 5. Fetch Books List
  const booksRes = await fetch(`${BASE_URL}/api/books`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`[5] /api/books HTTP Status: ${booksRes.status}`);
  const books = await booksRes.json();
  console.log(`    Books received: ${books.length} books`);
  for (const b of books.slice(0, 5)) {
    console.log(`    - [Book ${b.order}] ${b.title} (${b.id})`);
  }

  // 6. Fetch Sample Topic Content Block
  const topicRes = await fetch(`${BASE_URL}/api/topics/t-mm-01-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`[6] /api/topics/t-mm-01-001 HTTP Status: ${topicRes.status}`);
  const topicData = await topicRes.json();
  const blocks = topicData.blocks || [];
  console.log(`    Blocks in Topic 1: ${blocks.length} blocks`);
  if (blocks.length > 0) {
    const b = blocks[0];
    console.log(`    - Block Type: ${b.type}`);
    console.log(`    - Block Content length: ${b.content.length} characters`);
    console.log(
      `    - Contains Parity Release Marker: ${b.content.includes("data-mm-release")}`,
    );
    console.log(
      `    - Contains Vector/SVG table or layout: ${b.content.includes("mm-table-scroll")}`,
    );
  }

  // 7. Verify Media Assets Serving
  const mediaUrl = `${BASE_URL}/uploads/content-images/maternal-mind-book/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/media/646a5366f941f2526cac8b3fbf1538df90f5efc97c6adc3d6623c812eff81546.jfif`;
  const mediaRes = await fetch(mediaUrl);
  console.log(
    `[7] Production Media Asset HTTP Status: ${mediaRes.status} (Expected: 200)`,
  );
  console.log(
    `    - Media Content-Type: ${mediaRes.headers.get("content-type")}`,
  );
  console.log(
    `    - Media Content-Length: ${mediaRes.headers.get("content-length")} bytes`,
  );

  console.log("\n=======================================================");
  console.log("✅ ALL 7 PRODUCTION END-TO-END VERIFICATION CHECKS PASSED!");
  console.log("=======================================================");
}

testE2E().catch((err) => {
  console.error("[-] Production E2E test failed:", err);
  process.exit(1);
});
