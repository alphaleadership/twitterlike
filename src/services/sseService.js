/**
 * Service centralisé pour Server-Sent Events (SSE)
 * Permet de diffuser en temps réel des événements aux clients connectés
 */

class SseService {
  constructor() {
    this.clients = new Set();
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  /**
   * Enregistre un nouveau client SSE
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   * @param {Object} initialData 
   */
  addClient(req, res, initialData = {}) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Empêche la mise en cache par Nginx / proxies
      'Access-Control-Allow-Origin': '*'
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const client = { id: Date.now() + Math.random().toString(36).substr(2, 9), res, req };
    this.clients.add(client);

    // Émettre un événement initial de connexion
    this.sendToClient(client, 'connected', {
      clientId: client.id,
      timestamp: new Date().toISOString(),
      activeClients: this.clients.size,
      ...initialData
    });

    // Nettoyage à la déconnexion
    req.on('close', () => {
      this.clients.delete(client);
    });

    req.on('error', () => {
      this.clients.delete(client);
    });

    return client;
  }

  /**
   * Envoie un événement à un client spécifique
   */
  sendToClient(client, event, data) {
    try {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof client.res.flush === 'function') {
        client.res.flush();
      }
    } catch (_) {
      this.clients.delete(client);
    }
  }

  /**
   * Diffuse un événement à tous les clients connectés
   * @param {string} event 
   * @param {Object} data 
   */
  broadcast(event, data) {
    if (this.clients.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.res.write(payload);
        if (typeof client.res.flush === 'function') {
          client.res.flush();
        }
      } catch (_) {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Maintient les connexions ouvertes avec un ping régulier
   */
  startHeartbeat(intervalMs = 25000) {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.clients.size === 0) return;
      for (const client of this.clients) {
        try {
          client.res.write(': ping\n\n');
          if (typeof client.res.flush === 'function') {
            client.res.flush();
          }
        } catch (_) {
          this.clients.delete(client);
        }
      }
    }, intervalMs);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Notifie d'un changement de statut de la base MongoDB
   */
  notifyDbStatus(status, details = {}) {
    this.broadcast('db-status', {
      status,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Notifie d'un changement d'état du Mode CDN
   */
  notifyCdnMode(active, details = {}) {
    this.broadcast('cdn-mode', {
      active,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Notifie d'une interaction sur les tweets (like, hide, etc.)
   */
  notifyTweetInteraction(type, data = {}) {
    this.broadcast('tweet-interaction', {
      type,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Diffuse un nouveau tweet à tous les clients connectés via SSE
   */
  notifyNewTweet(tweet) {
    this.broadcast('new-tweet', tweet);
  }

  /**
   * Retourne le nombre de clients connectés
   */
  getClientCount() {
    return this.clients.size;
  }
}

// Instance singleton
const sseService = new SseService();

module.exports = sseService;
