/**
 * Visual reader audit: renders every compiled book topic with the REAL
 * ResponsiveBookDocument CSS at mobile (375px) + desktop (1280px) in headless
 * Chromium, and programmatically detects the defects that make flowcharts and
 * tables diverge from the book:
 *  - horizontal overflow (figure/table wider than viewport)
 *  - SVG figures rendered at zero size
 *  - figure text scaled down to illegible sizes (<9px effective)
 *  - broken image hrefs (non-2xx / failed requests)
 * Screenshots the worst offenders. Report -> temp dir (not the repo).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright-core");

const ROOT = "D:/Projects/Maternal Mind";
const REL_DIR = path.join(
  ROOT,
  "content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/topics",
);
const READER_TSX = path.join(ROOT, "client/components/ResponsiveBookDocument.tsx");
const PROD = "https://maternalmind.com.pk";
const OUT_DIR = "C:/Users/DRFAIS~1/AppData/Local/Temp/opencode/reader-audit";
const SHOT_DIR = path.join(OUT_DIR, "shots");

function extractScopedCss(tsx) {
  const m = tsx.match(/return `([\s\S]*)`;\s*\},\s*\[\]\);/);
  if (!m) throw new Error("scopedCss block not found in ResponsiveBookDocument.tsx");
  // Evaluate the ${`...`} nested template literals by unwrapping them.
  return m[1].replace(/\$\{`/g, "").replace(/`\}/g, "");
}

function extractWebViewScript(tsx) {
  // The exact <script> shipped inside the native WebView (dimension backfill,
  // heading shrink-to-fit, height messaging). Runs safely headless:
  // ReactNativeWebView posts are guarded, ResizeObserver exists in Chromium.
  const m = tsx.match(/<script>([\s\S]*?)<\/script>/);
  return m ? m[1] : "";
}

function absolutizeAssets(html) {
  return html
    .replace(/(href|src)="\/uploads\//g, '$1="' + PROD + "/uploads/")
    .replace(/(href|src)='\//g, "$1='" + PROD + "/");
}

function buildDoc(css, scriptJs, bodyHtml) {
  return (
    "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />" +
    "<style>" + css + "</style></head><body>" +
    '<div class="mm-book-document">' + bodyHtml + "</div>" +
    "<script>" + scriptJs + "</script></body></html>"
  );
}

async function auditViewport(page, css, scriptJs, bodyHtml, width, height) {
  const failed = [];
  page.removeAllListeners("response");
  page.removeAllListeners("requestfailed");
  page.on("response", (r) => {
    const u = r.url();
    if (/uploads|media|\.(jfif|png|jpg|jpeg|svg)/i.test(u) && r.status() >= 400) {
      failed.push({ url: u.slice(0, 120), status: r.status() });
    }
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (/uploads|media|\.(jfif|png|jpg|jpeg|svg)/i.test(u)) {
      failed.push({ url: u.slice(0, 120), status: "FAILED" });
    }
  });
  await page.setViewportSize({ width, height });
  await page.setContent(buildDoc(css, scriptJs, bodyHtml), { waitUntil: "load", timeout: 20000 });
  // Let SVG/images settle. ("load" not "networkidle": prod image latency
  // must never stall the audit; failures are still captured via listeners.)
  await page.waitForTimeout(400);
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const docOver = Math.max(0, doc.scrollWidth - doc.clientWidth);
    const figs = [...document.querySelectorAll(".mm-figure")].map((f) => ({
      over: Math.max(0, f.scrollWidth - f.clientWidth),
    }));
    const tbls = [...document.querySelectorAll(".mm-table-scroll")].map((t) => ({
      over: Math.max(0, t.scrollWidth - t.clientWidth),
    }));
    const svgs = [...document.querySelectorAll("svg")].map((s) => {
      const r = s.getBoundingClientRect();
      let vbW = 0;
      try { vbW = (s.viewBox && s.viewBox.baseVal && s.viewBox.baseVal.width) || 0; } catch (e) {}
      const sizes = [...s.querySelectorAll("text")].map((t) => {
        const fs = parseFloat(t.getAttribute("font-size") || "0");
        return fs;
      }).filter((v) => v > 0);
      // effective px for a 12pt-equivalent: natural px = vbW EMU * 96/914400
      const natPx = vbW > 0 ? (vbW * 96) / 914400 : 0;
      const scale = natPx > 0 && r.width > 0 ? r.width / natPx : 1;
      const minFs = sizes.length ? Math.min(...sizes) : 0;
      const effPx = minFs > 0 ? minFs * (96 / 72) * scale : 0;
      return { w: Math.round(r.width), h: Math.round(r.height), vbW: Math.round(vbW), minFs, effPx: Math.round(effPx * 10) / 10 };
    });
    const zeroSvgs = svgs.filter((s) => s.w === 0 || s.h === 0).length;
    const tinySvgs = svgs.filter((s) => s.effPx > 0 && s.effPx < 9).length;
    const minEff = svgs.reduce((a, s) => (s.effPx > 0 ? Math.min(a, s.effPx) : a), 999);
    return {
      docOver: Math.round(docOver),
      figOverMax: figs.length ? Math.round(Math.max(...figs.map((f) => f.over))) : 0,
      figOverCount: figs.filter((f) => f.over > 1).length,
      tblOverMax: tbls.length ? Math.round(Math.max(...tbls.map((t) => t.over))) : 0,
      tblOverCount: tbls.filter((t) => t.over > 1).length,
      svgCount: svgs.length,
      zeroSvgs,
      tinySvgs,
      minEffPx: minEff === 999 ? 0 : minEff,
    };
  });
  metrics.failedAssets = failed;
  return metrics;
}

function score(m375, m1280) {
  // Weighted defect score. Overflow px dominates; tiny text + broken assets add.
  return (
    m375.docOver * 2 +
    m375.figOverMax * 3 + m375.figOverCount * 20 +
    m375.tblOverMax * 2 + m375.tblOverCount * 15 +
    m375.zeroSvgs * 100 + m375.tinySvgs * 25 +
    m375.failedAssets.length * 60 +
    m1280.docOver + m1280.figOverMax + m1280.zeroSvgs * 50 +
    m1280.failedAssets.length * 30
  );
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const css = extractScopedCss(fs.readFileSync(READER_TSX, "utf8"));
  console.log("scoped CSS bytes:", css.length);
  const scriptJs = extractWebViewScript(fs.readFileSync(READER_TSX, "utf8"));
  console.log("webview script bytes:", scriptJs.length);
  const files = fs.readdirSync(REL_DIR).filter((f) => f.endsWith(".json")).sort();
  console.log("topics:", files.length);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const rows = [];
  let done = 0;
  for (const f of files) {
    const tid = f.replace(".json", "");
    try {
      const j = JSON.parse(fs.readFileSync(path.join(REL_DIR, f), "utf8"));
      const body = absolutizeAssets(j.blocks.map((b) => b.content).join("\n"));
      const m375 = await auditViewport(page, css, scriptJs, body, 375, 812);
      const m1280 = await auditViewport(page, css, scriptJs, body, 1280, 800);
      const s = score(m375, m1280);
      rows.push({ topic: tid, title: j.title, score: Math.round(s), m375, m1280 });
    } catch (e) {
      rows.push({ topic: tid, title: "", score: -1, error: String(e).slice(0, 160) });
    }
    done++;
    if (done % 25 === 0) console.log(`  ...${done}/${files.length}`);
  }

  rows.sort((a, b) => b.score - a.score);
  // Screenshot top 25 worst at mobile width.
  const worst = rows.filter((r) => r.score > 0).slice(0, 25);
  for (const r of worst) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(REL_DIR, r.topic + ".json"), "utf8"));
      const body = absolutizeAssets(j.blocks.map((b) => b.content).join("\n"));
      await page.setViewportSize({ width: 375, height: 812 });
      await page.setContent(buildDoc(css, scriptJs, body), { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SHOT_DIR, r.topic + ".png"), fullPage: true });
      r.shot = true;
    } catch (e) { r.shot = false; }
  }
  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    viewportMobile: 375,
    viewportDesktop: 1280,
    topics: rows,
  };
  fs.writeFileSync(path.join(OUT_DIR, "reader-audit-report.json"), JSON.stringify(report, null, 1));
  console.log("\n=== WORST 30 ===");
  rows.slice(0, 30).forEach((r) => {
    console.log(
      `${r.score}\t${r.topic}\tdocOver=${r.m375 && r.m375.docOver} figOver=${r.m375 && r.m375.figOverMax}x${r.m375 && r.m375.figOverCount} tblOver=${r.m375 && r.m375.tblOverMax}x${r.m375 && r.m375.tblOverCount} zeroSvg=${r.m375 && r.m375.zeroSvgs} tinySvg=${r.m375 && r.m375.tinySvgs} minEff=${r.m375 && r.m375.minEffPx}px badAssets=${(r.m375 && r.m375.failedAssets.length) || 0}`,
    );
  });
  const withDefects = rows.filter((r) => r.score > 0).length;
  console.log(`\ntopics with defects: ${withDefects}/${rows.length}`);
  console.log("report:", path.join(OUT_DIR, "reader-audit-report.json"));
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
