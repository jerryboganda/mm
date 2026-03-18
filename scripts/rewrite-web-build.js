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

function main() {
  if (!fs.existsSync(WEB_DIST)) {
    throw new Error(`web_dist not found at ${WEB_DIST}`);
  }

  const indexPath = path.join(WEB_DIST, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`index.html not found in ${WEB_DIST}`);
  }

  rewriteFile(indexPath, [
    [/href="\/favicon\.ico"/g, `href="${WEB_ROUTE_PREFIX}/favicon.ico"`],
    [/src="\/_expo\//g, `src="${WEB_ROUTE_PREFIX}/_expo/`],
  ]);

  const webJsDir = path.join(WEB_DIST, "_expo", "static", "js", "web");
  if (fs.existsSync(webJsDir)) {
    for (const file of fs.readdirSync(webJsDir)) {
      if (!file.endsWith(".js")) continue;

      rewriteFile(path.join(webJsDir, file), [
        [/"\/assets\//g, `"${WEB_ROUTE_PREFIX}/assets/`],
        [/"\/_expo\//g, `"${WEB_ROUTE_PREFIX}/_expo/`],
        [/"\/favicon\.ico"/g, `"${WEB_ROUTE_PREFIX}/favicon.ico"`],
      ]);
    }
  }

  console.log(`Rewrote web build assets for ${WEB_ROUTE_PREFIX}`);
}

main();
