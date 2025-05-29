// Vercel serverless function entry point
const path = require('path');

// Import the main server module
const app = require('../backend/server.js');

module.exports = app;