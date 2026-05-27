const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Candidate = require('../models/candidate');

// GET /api/candidates - List candidates
router.get('/', async (req, res) => {
  try {
    const { page, limit, skills, source, search } = req.query;
    const result = await Candidate.findAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      skills,
      source,
      search
    });
    res.json(result);
  } catch (error) {
    console.error('List candidates error:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// GET /api/candidates/:id - Get candidate with parsed resume
router.get('/:id',
  param('id').isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const candidate = await Candidate.findById(req.params.id);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      // Get latest parsed resume from MongoDB
      const mongoose = require('mongoose');
      const ResumeDocument = require('../models/resumeDocument');
      const resume = await ResumeDocument.findOne({ candidate_id: req.params.id })
        .sort({ parsed_at: -1 });

      res.json({
        ...candidate,
        latest_resume: resume || null
      });
    } catch (error) {
      console.error('Get candidate error:', error);
      res.status(500).json({ error: 'Failed to fetch candidate' });
    }
  }
);

// POST /api/candidates - Create candidate
router.post('/',
  body('email').isEmail(),
  body('name').isLength({ min: 1, max: 255 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existing = await Candidate.findByEmail(req.body.email);
      if (existing) {
        return res.status(409).json({ error: 'Candidate with this email already exists' });
      }

      const candidate = await Candidate.create(req.body);
      res.status(201).json(candidate);
    } catch (error) {
      console.error('Create candidate error:', error);
      res.status(500).json({ error: 'Failed to create candidate' });
    }
  }
);

// POST /api/candidates/import - Bulk import from portal
router.post('/import', async (req, res) => {
  try {
    const { candidates } = req.body;
    if (!Array.isArray(candidates)) {
      return res.status(400).json({ error: 'candidates must be an array' });
    }

    const results = [];
    for (const c of candidates) {
      try {
        const existing = await Candidate.findByEmail(c.email);
        if (existing) {
          results.push({ ...c, status: 'skipped', reason: 'duplicate' });
        } else {
          const created = await Candidate.create(c);
          results.push({ ...created, status: 'created' });
        }
      } catch (e) {
        results.push({ ...c, status: 'error', error: e.message });
      }
    }

    res.json({ imported: results.length, results });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to import candidates' });
  }
});

// PUT /api/candidates/:id - Update candidate
router.put('/:id',
  param('id').isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const candidate = await Candidate.update(req.params.id, req.body);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      res.json(candidate);
    } catch (error) {
      console.error('Update candidate error:', error);
      res.status(500).json({ error: 'Failed to update candidate' });
    }
  }
);

// DELETE /api/candidates/:id - Soft delete candidate
router.delete('/:id',
  param('id').isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      await Candidate.delete(req.params.id);
      res.json({ message: 'Candidate deleted successfully' });
    } catch (error) {
      console.error('Delete candidate error:', error);
      res.status(500).json({ error: 'Failed to delete candidate' });
    }
  }
);

module.exports = router;