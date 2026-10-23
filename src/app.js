const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const { connectToMongo, getClient, isMongoConnected, mongoose } = require('./config/db');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const webRoutes = require('./routes/web');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');
const Admin = require('./models/Admin'); // Import Admin model
const sseService = require('./services/sseService');
require('dotenv').config(); // Load environment variables

// Initialize Express app
const app = express();

const helmet = require('helmet');
const compression = require('compression');

// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline for simple EJS logic
      scriptSrcAttr: ["'unsafe-inline'"], // allow inline attributes like onerror
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "http://localhost:3000", "http://localhost:3002", "https://*.twimg.com", "https://pbs.twimg.com"],
      mediaSrc: ["'self'", "http://localhost:3000", "http://localhost:3002", "https://*.twimg.com", "https://video.twimg.com"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Gzip Compression (exclut le flux SSE pour permettre l'envoi immédiat des événements)
app.use(compression({
  filter: (req, res) => {
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Session setup
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const MemoryStore = require('memorystore')(session);

const memoryStore = new MemoryStore({ checkPeriod: 86400000 });
let mongoStore = null;

// CDN mode flag (forced via ENV or automatic when MongoDB is down)
const forcedCdnMode = process.env.CDN_MODE === 'true';
let cdnMode = forcedCdnMode || !isMongoConnected();

function setCdnMode(active) {
  if (forcedCdnMode) {
    cdnMode = true;
    return;
  }
  if (cdnMode !== active) {
    cdnMode = active;
    console.log(`[App] Mode CDN ${cdnMode ? 'ACTIVÉ automatiquement (MongoDB indisponible)' : 'DÉSACTIVÉ (MongoDB connecté)'}`);
    sseService.notifyCdnMode(cdnMode, { mongoConnected: isMongoConnected() });
  }
}

function initMongoStore(clientInstance) {
  if (!clientInstance) return;
  try {
    mongoStore = MongoStore.create({
      client: clientInstance,
      dbName: 'twitter_db',
      ttl: 14 * 24 * 60 * 60,
      autoRemove: 'interval',
      autoRemoveInterval: 10,
      touchAfter: 24 * 3600 // Lazy update: ne met à jour MongoDB qu'une fois toutes les 24h si la session n'est pas modifiée
    });
  } catch (err) {
    console.warn('[Session] Erreur initialisation MongoStore:', err.message);
    mongoStore = null;
  }
}

// Dynamic session store: delegates to MongoStore if connected, MemoryStore otherwise
class DynamicSessionStore extends session.Store {
  getStore() {
    if (!cdnMode && mongoStore && isMongoConnected()) {
      return mongoStore;
    }
    return memoryStore;
  }

  get(sid, cb) {
    return this.getStore().get(sid, cb);
  }

  set(sid, sess, cb) {
    return this.getStore().set(sid, sess, cb);
  }

  destroy(sid, cb) {
    return this.getStore().destroy(sid, cb);
  }

  touch(sid, sess, cb) {
    const store = this.getStore();
    if (store.touch) return store.touch(sid, sess, cb);
    if (cb) cb();
  }

  all(cb) {
    const store = this.getStore();
    if (store.all) return store.all(cb);
    if (cb) cb(null, []);
  }

  length(cb) {
    const store = this.getStore();
    if (store.length) return store.length(cb);
    if (cb) cb(null, 0);
  }

  clear(cb) {
    const store = this.getStore();
    if (store.clear) return store.clear(cb);
    if (cb) cb();
  }
}

const sessionBase = {
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  store: new DynamicSessionStore(),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 14, secure: process.env.NODE_ENV === 'production', httpOnly: true }
};

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // default layout
app.enable('view cache'); // Mise en cache des templates EJS pour éviter la lecture disque répétée

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (always available, even without MongoDB)
app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0');
    }
  }
}));

// Serve static files from dist directory (index: false prevents hijacking the root route '/')
app.use(express.static(path.join(__dirname, '../dist'), { maxAge: '7d', index: false }));

// CDN Gate: when MongoDB is down and CDN mode is active, handle non-static requests gracefully
app.use((req, res, next) => {
  if (!cdnMode) return next();

  // Le flux SSE et son statut doivent rester accessibles en mode CDN pour notifier de la reconnexion
  if (req.path === '/api/events' || req.path === '/events' || req.path === '/api/events/status') {
    return next();
  }

  // If a public asset wasn't matched by express.static
  if (req.path.startsWith('/public')) {
    return res.status(404).send('Asset not found');
  }

  // API endpoints return 503 JSON in CDN mode
  if (req.path.startsWith('/api')) {
    return res.status(503).json({
      success: false,
      error: {
        status: 503,
        message: 'Mode CDN actif : base de données MongoDB indisponible. Seuls les médias et fichiers statiques sont servis.'
      }
    });
  }

  // HTML pages return informative CDN mode message avec écoute SSE pour reconnexion automatique
  return res.status(503).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mode CDN - TwitterClone</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #15202b;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          text-align: center;
          max-width: 520px;
          padding: 32px;
          background: #192734;
          border-radius: 16px;
          border: 1px solid #38444d;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        h1 { font-size: 22px; margin: 12px 0; }
        p { color: #8899a6; line-height: 1.5; font-size: 15px; }
        .badge {
          display: inline-block;
          background: #1d9bf0;
          color: white;
          padding: 6px 14px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: bold;
        }
        .sse-indicator {
          margin-top: 18px;
          font-size: 13px;
          color: #1d9bf0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .dot {
          width: 8px;
          height: 8px;
          background-color: #00ba7c;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.7; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">Mode CDN Automatique</div>
        <h1>Base de données inaccessible</h1>
        <p>Le serveur est automatiquement passé en mode CDN suite à l'indisponibilité de MongoDB. Les contenus statiques et médias restent accessibles.</p>
        <div class="sse-indicator">
          <span class="dot"></span>
          <span>Écoute SSE active : la page s'actualisera automatiquement dès la reconnexion.</span>
        </div>
      </div>
      <script>
        const es = new EventSource('/api/events');
        es.addEventListener('cdn-mode', function(e) {
          try {
            const data = JSON.parse(e.data);
            if (!data.active) {
              window.location.reload();
            }
          } catch (_) {}
        });
        es.addEventListener('db-status', function(e) {
          try {
            const data = JSON.parse(e.data);
            if (data.status === 'connected') {
              window.location.reload();
            }
          } catch (_) {}
        });
      </script>
    </body>
    </html>
  `);
});

// Session middleware (only needed for dynamic routes)
app.use(session(sessionBase));

// Middleware to store previous URLs (uniquement pour les requêtes de navigation web)
app.use((req, res, next) => {
  if (!req.session) return next();
  if (req.method !== 'GET') return next();
  const path = req.path;
  if (path.startsWith('/public') || path.startsWith('/api') || path.startsWith('/events')) {
    return next();
  }
  if (!req.session.previousUrls) {
    req.session.previousUrls = [];
  }
  if (req.session.previousUrls[0] !== req.originalUrl) {
    req.session.previousUrls.unshift(req.originalUrl);
    if (req.session.previousUrls.length > 2) {
      req.session.previousUrls.pop();
    }
  }
  next();
});

// Web Routes (for EJS rendering)
app.use('/', webRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);

// API Routes
app.use('/api', apiRoutes);

// Handle 404 - Keep this as the last route
app.use((req, res, next) => {
  res.status(404).render('404');
});

// Error handling middleware
app.use(errorHandler);

// Listen to MongoDB connection events to automatically toggle CDN mode & broadcast via SSE
mongoose.connection.on('connected', () => {
  const client = getClient();
  if (client) {
    initMongoStore(client);
  }
  setCdnMode(false);
  sseService.notifyDbStatus('connected', { cdnMode: false });
});

mongoose.connection.on('disconnected', () => {
  setCdnMode(true);
  sseService.notifyDbStatus('disconnected', { cdnMode: true });
});

// Helper methods exposed on app instance
app.setCdnMode = setCdnMode;
app.getCdnMode = () => cdnMode;
app.initMongoStore = initMongoStore;

// Connect to MongoDB and start the server
const PORT = process.env.PORT || 3002;

async function startServer(port = PORT) {
  try {
    const { client } = await connectToMongo();
    if (client) {
      initMongoStore(client);
    }
    setCdnMode(false);
  } catch (error) {
    console.warn('[MongoDB] Erreur de connexion au démarrage :', error.message);
    setCdnMode(true);
  }

  const server = app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port} (Mode CDN : ${cdnMode ? 'ACTIF' : 'INACTIF'})`);
  });

  return server;
}

app.startServer = startServer;

// Start the server only if executed directly (node src/app.js)
if (require.main === module) {
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  startServer();
}

module.exports = app;