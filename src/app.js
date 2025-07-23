const express = require('express');
const path = require('path');
const { connectToMongo } = require('./config/db');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory for EJS templates
app.use('/public', express.static(path.join(__dirname, 'public')));

// Web Routes (for EJS rendering) - MUST come before SPA fallback
app.use('/', webRoutes);

// Serve static files from the dist directory for the SPA (if still used)
app.use(express.static(path.join(__dirname, '../dist')));

// API Routes
app.use('/api', apiRoutes);

// Handle SPA (Single Page Application) - serve index.html for any other routes not handled by webRoutes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Connect to MongoDB and start the server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectToMongo();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;