/**
 * WS5c definitive live verification: every topic on production serves the
 * NEW fixed content (dimensioned SVGs), nothing missing, learner account.
 * Throttled + 429-aware (API allows ~120 req/min).
 */
const BASE = "https://maternalmind.com.pk";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(r) {
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.json();
}
async function get(url, headers, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers });
    if (r.status === 429) {
      await sleep(15000 * (i + 1));
      continue;
    }
    return await j(r);
  }
  throw new Error("HTTP 429 persistent");
}
async function main() {
  const login = await j(
    await fetch(BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "mindreader420123@gmail.com",
        password: "12345678",
      }),
    }),
  );
  const H = { Authorization: "Bearer " + login.accessToken };
  const books = await get(BASE + "/api/books", H);
  console.log("books:", books.length);
  let topicIds = [];
  for (const b of books) {
    const ch = await get(`${BASE}/api/books/${b.id}/chapters`, H);
    for (const c of ch) {
      const tp = await get(`${BASE}/api/chapters/${c.id}/topics`, H);
      tp.forEach((t) => topicIds.push(t.id));
    }
    await sleep(800);
  }
  console.log("topics listed:", topicIds.length);
  let ok = 0,
    noDims = [],
    empty = [],
    errors = [];
  for (let i = 0; i < topicIds.length; i++) {
    const tid = topicIds[i];
    try {
      const t = await get(`${BASE}/api/topics/${tid}`, H);
      if (!t.blocks || !t.blocks.length) {
        empty.push(tid);
        continue;
      }
      const html = t.blocks.map((b) => b.content).join("\n");
      const svgCount = (html.match(/<svg\b/g) || []).length;
      const dimCount = (html.match(/data-mm-natural-width/g) || []).length;
      if (svgCount > 0 && dimCount < svgCount) noDims.push({ tid, svgCount, dimCount });
      else ok++;
    } catch (e) {
      errors.push({ tid, err: String(e).slice(0, 80) });
    }
    await sleep(700);
    if ((i + 1) % 40 === 0) console.log(`  ...${i + 1}/${topicIds.length}`);
  }
  console.log("\n=== LIVE PROD RESULT ===");
  console.log("topics OK (new fixed content):", ok);
  console.log("topics with EMPTY blocks:", empty.length, empty.slice(0, 5));
  console.log("topics with SVG missing dims:", noDims.length, JSON.stringify(noDims.slice(0, 5)));
  console.log("fetch errors:", errors.length, JSON.stringify(errors.slice(0, 5)));
}
main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
