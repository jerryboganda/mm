// Hostinger Phusion Passenger Node.js Web App Entry Point
const serverModule = require('./server_dist/index.js');
const app = serverModule.default || serverModule.app || serverModule;

module.exports = app;
