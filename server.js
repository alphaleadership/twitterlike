require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectToMongo, closeConnection } = require('./src/config/db');

const PORT = process.env.PORT || 3002;

let server;

async function startServer() {
  try {
    const { client } = await connectToMongo();
    if (app.initMongoStore && client) {
      app.initMongoStore(client);
    }
    if (app.setCdnMode) {
      app.setCdnMode(false);
    }
  } catch (error) {
    console.warn('[MongoDB] Erreur de connexion au démarrage :', error.message);
    if (app.setCdnMode) {
      app.setCdnMode(true);
    }
  }

  server = http.createServer(app);

  server.listen(PORT, () => {
    const isCdn = app.getCdnMode ? app.getCdnMode() : false;
    console.log(`Serveur démarré sur http://localhost:${PORT} (Mode CDN : ${isCdn ? 'ACTIF' : 'INACTIF'})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Serveur] Erreur : Le port ${PORT} est déjà utilisé.`);
    } else {
      console.error('[Serveur] Erreur serveur :', err);
    }
    process.exit(1);
  });

  return server;
}

// Arrêt gracieux (Graceful shutdown)
const gracefulShutdown = async (signal) => {
  console.log(`\nSignal ${signal} reçu : fermeture du serveur...`);
  if (server) {
    server.close(async () => {
      try {
        await closeConnection();
        console.log('Connexions fermées avec succès. Serveur arrêté.');
        process.exit(0);
      } catch (err) {
        console.error('Erreur lors de la fermeture des connexions :', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, getServer: () => server };
