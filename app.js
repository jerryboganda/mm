const fs = require("fs");
const path = require("path");

const logFile = path.join(__dirname, "passenger_error.log");
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
}

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err}`);
});

process.on("unhandledRejection", (reason) => {
  log(`UNHANDLED REJECTION: ${reason?.stack || reason}`);
});

log("Starting Maternal Mind Express API via Hostinger Passenger...");
try {
  require("./server_dist/index.js");
  log("server_dist/index.js loaded successfully!");
} catch (err) {
  log(`FATAL ERROR loading server_dist/index.js: ${err.stack || err}`);
}
