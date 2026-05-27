const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Application = require('../models/application');

// GET /api/applications - List applications
router.get('/', async (req, res) => {
  try {
    const { page, limit, candidate_id, job_id, stage } = req.query;
    const result = await Application.findAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      candidate_id,
      job_id,
      stage
    });
    res.json(result);
  } catch (error) {
    console.error('List applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// POST /api/applications - Create application
router.post('/',
  body('candidate_id').isUUID(),
  body('job_id').isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existing = await Application.findByCandidateAndJob(req.body.candidate_id, req.body.job_id);
      if (existing) {
        return res.status(409).json({ error: 'Application already exists for this candidate and job' });
      }

      const application = await Application.create(req.body);
      res.status(201).json(application);
    } catch (error) {
      console.error('Create application error:', error);
      res.status(500).json({ error: 'Failed to create application' });
    }
  }
);

// PUT /api/applications/:id/stage - Update application stage
router.put('/:id/stage',
  param('id').isUUID(),
  body('stage').isIn(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const application = await Application.updateStage(req.params.id, req.body.stage);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      res.json(application);
    } catch (error) {
      console.error('Update stage error:', error);
      res.status(500).json({ error: 'Failed to update application stage' });
    }
  }
);

module.exports = router;