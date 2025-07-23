require('dotenv').config();
const app = require('./src/app');

// The app will automatically start the server when imported
// This file is kept as a thin entry point for better compatibility

// Export the app for testing purposes
module.exports = app;
