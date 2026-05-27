const express = require('express');
const router = express.Router();
const SyncLog = require('../models/syncLog');
const PortalSyncService = require('../services/portalSync');

// GET /api/sync/status - Get last sync status per portal
router.get('/status', async (req, res) => {
  try {
    const statuses = await SyncLog.getLatestStatus();
    res.json({ portals: statuses });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// POST /api/sync/trigger - Manually trigger full sync
router.post('/trigger', async (req, res) => {
  try {
    const { portal } = req.body;
    const portals = portal ? [portal] : ['naukri', 'linkedin'];

    const results = [];
    for (const p of portals) {
      try {
        await PortalSyncService.triggerFullSync(p);
        results.push({ portal: p, status: 'triggered' });
      } catch (e) {
        results.push({ portal: p, status: 'failed', error: e.message });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Trigger sync error:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

module.exports = router;