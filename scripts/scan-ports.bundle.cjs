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

// scripts/scan-ports.mjs
var import_net = __toESM(require("net"), 1);
async function checkPort(port) {
  return new Promise((resolve) => {
    const s = import_net.default.createConnection({ port, host: "127.0.0.1", timeout: 300 });
    s.on("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.on("timeout", () => {
      s.destroy();
      resolve(false);
    });
  });
}
async function main() {
  console.log("Scanning open ports on 127.0.0.1 (3000 to 9000)...");
  const openPorts = [];
  for (let p = 3e3; p <= 9e3; p++) {
    const open = await checkPort(p);
    if (open) {
      console.log(`[OPEN PORT] ${p}`);
      openPorts.push(p);
    }
  }
  console.log("Scan complete. Open ports:", openPorts);
}
main().catch(console.error);
