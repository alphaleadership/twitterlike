const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const { connectToMongo } = require('./config/db');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const webRoutes = require('./routes/web');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');
const Admin = require('./models/Admin'); // Import Admin model
require('dotenv').config(); // Load environment variables

// Initialize Express app
const app = express();

// Session setup
const session = require('express-session');
var FileStore = require('session-file-store')(session);


// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // default layout
var fileStoreOptions = {};
// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  store:new FileStore(fileStoreOptions),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true
  }
}));

// Middleware to store previous URLs
app.use((req, res, next) => {
  

  // Only store URLs that are not from the /public directory
  if (!req.originalUrl.startsWith('/public')) {
    if (!req.session.previousUrls) {
    req.session.previousUrls = [];
  }
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
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);

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

    // Check if admin collection is empty and create owner account if needed
   /* console.log('Checking for existing admin accounts...');
    const adminCount = await Admin.countDocuments();
    console.log(`Found ${adminCount} admin accounts.`);
    if (adminCount === 0 && process.env.OWNER_USERNAME && process.env.OWNER_PASSWORD) {
      console.log('No admin accounts found. Attempting to create default owner admin account...');
      const ownerAdmin = new Admin({
        username: process.env.OWNER_USERNAME,
        password: process.env.OWNER_PASSWORD
      });
      await ownerAdmin.save();
      console.log('Default owner admin account created successfully.');
    } else if (adminCount > 0) {
      console.log('Admin accounts already exist. Skipping default owner account creation.');
    } else {
      console.log('OWNER_USERNAME or OWNER_PASSWORD environment variables are not set. Skipping default owner account creation.');
    }
*/
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