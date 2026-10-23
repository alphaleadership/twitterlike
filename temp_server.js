require('dotenv').config();
const { app, startServer } = require('./server');

module.exports = app;
module.exports.startServer = startServer;
