const fs = require("fs");
const path = require("path");

const WEB_DIST = path.resolve(process.cwd(), "web_dist");
const WEB_ROUTE_PREFIX = "/app";

function rewriteFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf8");
  let updated = content;

  for (const [from, to] of replacements) {
    if (from instanceof RegExp) {
      updated = updated.replace(from, to);
    } else {
      updated = updated.split(from).join(to);
    }
  }

  if (updated !== content) {
    fs.writeFileSync(filePath, updated);
  }
}

function getAllFiles(dir, extensions = [".js", ".json", ".css", ".html"]) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  if (!fs.existsSync(WEB_DIST)) {
    throw new Error(`web_dist not found at ${WEB_DIST}`);
  }

  const indexPath = path.join(WEB_DIST, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`index.html not found in ${WEB_DIST}`);
  }

  // 1. Rewrite index.html links and scripts
  rewriteFile(indexPath, [
    [/href="\/favicon\.ico"/g, `href="${WEB_ROUTE_PREFIX}/favicon.ico"`],
    [/src="\/_expo\//g, `src="${WEB_ROUTE_PREFIX}/_expo/`],
    [/href="\/_expo\//g, `href="${WEB_ROUTE_PREFIX}/_expo/`],
    [/src="\/assets\//g, `src="${WEB_ROUTE_PREFIX}/assets/`],
    [/href="\/assets\//g, `href="${WEB_ROUTE_PREFIX}/assets/`],
  ]);

  // 2. Recursively rewrite all bundle assets in web_dist
  const allFiles = getAllFiles(WEB_DIST);
  let rewrittenCount = 0;

  for (const file of allFiles) {
    if (file === indexPath) continue;

    rewriteFile(file, [
      [/"\/assets\//g, `"${WEB_ROUTE_PREFIX}/assets/`],
      [/'\/assets\//g, `'${WEB_ROUTE_PREFIX}/assets/`],
      [/url\(["']?\/assets\//g, `url(${WEB_ROUTE_PREFIX}/assets/`],
      [/"\/_expo\//g, `"${WEB_ROUTE_PREFIX}/_expo/`],
      [/'\/_expo\//g, `'${WEB_ROUTE_PREFIX}/_expo/`],
      [/url\(["']?\/_expo\//g, `url(${WEB_ROUTE_PREFIX}/_expo/`],
      [/"\/favicon\.ico"/g, `"${WEB_ROUTE_PREFIX}/favicon.ico"`],
    ]);
    rewrittenCount++;
  }

  console.log(
    `[REWRITE-WEB-BUILD] Rewrote assets for ${WEB_ROUTE_PREFIX} across ${rewrittenCount + 1} files in web_dist`,
  );
}

main();
