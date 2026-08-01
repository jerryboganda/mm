// Hostinger Phusion Passenger Node.js Web App Entry Point
const http = require("http");
const serverModule = require("./server_dist/index.js");
const app = serverModule.default || serverModule.app || serverModule;

const port = process.env.PORT || 3000;

if (typeof app === "function") {
  const server = http.createServer(app);
  server.listen(port, () => {
    console.log(`Maternal Mind Express server running on port ${port}`);
  });
  module.exports = server;
} else {
  module.exports = app;
}
