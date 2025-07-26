const express = require('express');
const path = require('path');
const { connectToMongo } = require('./config/db');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Session setup
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/twitter_db',
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'interval',
    autoRemoveInterval: 10 // In minutes. Removes expired sessions every 10 minutes
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true
  }
}));

// Middleware to store previous URLs
app.use((req, res, next) => {
  if (!req.session.previousUrls) {
    req.session.previousUrls = [];
  }

  // Only store URLs that are not from the /public directory
  if (!req.originalUrl.startsWith('/public')) {
    // Add current URL to the beginning of the array
    // Only if it's not the same as the last one (to avoid duplicates on refresh)
    if (req.session.previousUrls[0] !== req.originalUrl) {
      req.session.previousUrls.unshift(req.originalUrl);
    }

    // Keep only the last two URLs
    if (req.session.previousUrls.length > 2) {
      req.session.previousUrls.pop();
    }
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const fs = require('fs');
const morgan = require('morgan');
// Setup the logger
const accessLogStream = fs.createWriteStream(path.join(__dirname, '../access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Log to console as well

// Serve static files from the public directory for EJS templates
app.use('/public', express.static(path.join(__dirname, 'public')));

// Web Routes (for EJS rendering) - MUST come before SPA fallback
app.use('/', webRoutes);

// Serve static files from the dist directory for the SPA (if still used)
app.use(express.static(path.join(__dirname, '../dist')));

// API Routes
app.use('/api', apiRoutes);

// Handle 404 - Keep this as the last route
app.use((req, res, next) => {
  res.status(404).render('404');
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