const sseService = require('../services/sseService');
const { isMongoConnected } = require('../config/db');

/**
 * Contrôleur pour le flux SSE
 */
const sseController = {
  handleEvents(req, res) {
    const app = req.app;
    const isCdn = typeof app.getCdnMode === 'function' ? app.getCdnMode() : false;
    const mongoStatus = isMongoConnected() ? 'connected' : 'disconnected';

    sseService.addClient(req, res, {
      mongoConnected: isMongoConnected(),
      mongoStatus,
      cdnMode: isCdn
    });
  },

  getStatus(req, res) {
    const app = req.app;
    const isCdn = typeof app.getCdnMode === 'function' ? app.getCdnMode() : false;
    res.json({
      success: true,
      data: {
        activeSseClients: sseService.getClientCount(),
        mongoConnected: isMongoConnected(),
        cdnMode: isCdn,
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = sseController;
