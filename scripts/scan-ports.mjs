import net from "net";

async function checkPort(port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host: "127.0.0.1", timeout: 300 });
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
  for (let p = 3000; p <= 9000; p++) {
    const open = await checkPort(p);
    if (open) {
      console.log(`[OPEN PORT] ${p}`);
      openPorts.push(p);
    }
  }
  console.log("Scan complete. Open ports:", openPorts);
}

main().catch(console.error);
