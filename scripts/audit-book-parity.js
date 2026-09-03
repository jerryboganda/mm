/**
 * Book content parity audit: production (learner account) vs compiled release.
 * Fetches every topic detail from the live API, computes sha256 of each block,
 * compares against the authoritative release manifest, writes a JSON report.
 */
const fs = require("fs");
const crypto = require("crypto");
const BASE = "https://maternalmind.com.pk";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXPECTED =
  JSON.parse(
    fs.readFileSync(
      "D:\\Projects\\Maternal Mind\\.tmp_expected_blocks.json",
      "utf8",
    ),
  ) || {};

async function getJson(url, headers, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers });
    if (res.ok) {
      try {
        return await res.json();
      } catch {}
    }
    await sleep(Math.min(180000, 15000 * (i + 1)));
  }
  return null;
}

async function main() {
  const reportPath = "D:\\Projects\\Maternal Mind\\.tmp_parity_report.json";
  const report = fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
    : { startedAt: "", topics: {}, books: {}, progress: 0 };
  if (!report.startedAt) {
    report.startedAt = new Date().toISOString();
    report.topics = {};
    report.books = {};
  }

  let login = null;
  for (let i = 0; i < 6; i++) {
    login = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "mindreader420123@gmail.com",
        password: "12345678",
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (login && login.accessToken) break;
    await sleep(30000);
  }
  if (!login || !login.accessToken) {
    console.log("LOGIN FAILED");
    return;
  }
  const headers = { Authorization: `Bearer ${login.accessToken}` };

  let books = await getJson(`${BASE}/api/books`, headers);
  if (!books) {
    console.log("BOOKS FETCH FAILED");
    return;
  }
  report.books.all = books.length;
  const bookQueue = books.filter(
    (b) => b.id.startsWith("book-mm") && !report.books[b.id],
  );
  console.log("Pending books:", bookQueue.map((b) => b.id).join(","));

  for (const b of bookQueue) {
    const chapters = await getJson(
      `${BASE}/api/books/${b.id}/chapters`,
      headers,
    );
    if (!chapters) {
      console.log("CHAP FAIL", b.id);
      setTimeout(() => {}, 999999);
      return;
    }
    const info = { chapters: chapters.length, topics: 0 };
    for (const ch of chapters) {
      const tlist = await getJson(
        `${BASE}/api/chapters/${ch.id}/topics`,
        headers,
      );
      if (!tlist) continue;
      info.topics += tlist.length;
      for (const t of tlist) {
        info[t.id] = {
          title: t.title,
          order: t.order,
          expected: EXPECTED[t.id] ? EXPECTED[t.id].length : null,
        };
        const tdet = await getJson(`${BASE}/api/topics/${t.id}`, headers);
        if (tdet && Array.isArray(tdet.blocks)) {
          // Normalize CRLF (Postgres/SQL transport) to LF so the digest
          // verifies semantic content parity, not line-ending bytes.
          const digests = tdet.blocks.map((bl) =>
            crypto
              .createHash("sha256")
              .update((bl.content || "").replace(/\r\n/g, "\n"), "utf8")
              .digest("hex"),
          );
          const exp = EXPECTED[t.id];
          report.topics[t.id] = {
            title: t.title,
            prodBlocks: digests.length,
            expBlocks: exp ? exp.length : null,
            mismatch: exp
              ? JSON.stringify(digests) !== JSON.stringify(exp)
              : true,
            unknown: !exp,
            hasReleaseMarker: digests.length === 0 ? null : digests.length,
          };
        } else {
          report.topics[t.id] = {
            title: t.title,
            error: "detail_fetch_failed",
          };
        }
        await sleep(700);
      }
    }
    report.books[b.id] = info;
    fs.writeFileSync(reportPath, JSON.stringify(report));
    console.log("COMPLETED BOOK", b.id, info.topics, "topics");
  }

  const allTopics = Object.values(report.topics);
  const summary = {
    booksAudited: Object.keys(report.books).filter((k) => k !== "all").length,
    topicsAudited: allTopics.length,
    topicsWithContent: allTopics.filter((t) => !t.error && t.prodBlocks > 0)
      .length,
    topicsNoContent: allTopics.filter((t) => !t.error && t.prodBlocks === 0)
      .length,
    topicsMismatch: allTopics.filter((t) => t.mismatch).length,
    topicsUnknown: allTopics.filter((t) => t.unknown).length,
    fetchErrors: allTopics.filter((t) => t.error).length,
  };
  console.log("SUMMARY", JSON.stringify(summary, null, 1));
  fs.writeFileSync(reportPath, JSON.stringify(report));
}

main().catch((e) => {
  console.log("ERR", e.message);
});
