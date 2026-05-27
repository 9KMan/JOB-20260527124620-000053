const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Job = require('../models/job');
const PortalSyncService = require('../services/portalSync');

// GET /api/jobs - List jobs
router.get('/', async (req, res) => {
  try {
    const { page, limit, status, department, portal_source } = req.query;
    const result = await Job.findAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      status,
      department,
      portal_source
    });
    res.json(result);
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id - Get job with application count
router.get('/:id',
  param('id').isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const job = await Job.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json(job);
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  }
);

// POST /api/jobs - Create job
router.post('/',
  body('title').isLength({ min: 1, max: 500 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const job = await Job.create(req.body);
      res.status(201).json(job);
    } catch (error) {
      console.error('Create job error:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  }
);

// PUT /api/jobs/:id/sync - Trigger manual portal sync
router.put('/:id/sync',
  param('id').isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const job = await Job.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Trigger sync
      PortalSyncService.syncJobFromPortal(job.id);

      res.json({ message: 'Sync triggered', job_id: job.id });
    } catch (error) {
      console.error('Trigger sync error:', error);
      res.status(500).json({ error: 'Failed to trigger sync' });
    }
  }
);

module.exports = router;