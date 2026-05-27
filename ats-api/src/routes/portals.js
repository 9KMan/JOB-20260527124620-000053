const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const PortalConfig = require('../models/portalConfig');
const SyncLog = require('../models/syncLog');

// POST /api/portals/naukri/webhook - Naukri webhook receiver
router.post('/naukri/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-naukri-signature'];
    const portalConfig = await PortalConfig.findByPortalName('naukri');

    if (!portalConfig || !portalConfig.webhook_secret) {
      return res.status(503).json({ error: 'Webhook not configured' });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', portalConfig.webhook_secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook payload
    const { event_type, data } = req.body;

    switch (event_type) {
      case 'new_application':
        await handleNewApplication(data);
        break;
      case 'application_update':
        await handleApplicationUpdate(data);
        break;
      default:
        console.log('Unknown webhook event:', event_type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleNewApplication(data) {
  // Handle new application from Naukri
  const Candidate = require('../models/candidate');
  const Application = require('../models/application');
  const Job = require('../models/job');

  const { candidate_email, candidate_name, phone, job_portal_id } = data;

  // Find or create candidate
  let candidate = await Candidate.findByEmail(candidate_email);
  if (!candidate) {
    candidate = await Candidate.create({
      email: candidate_email,
      name: candidate_name,
      phone,
      source: 'naukri',
      portal_id: candidate_email
    });
  }

  // Find job by portal ID
  const job = await Job.findByPortalId('naukri', job_portal_id);
  if (job) {
    const existingApp = await Application.findByCandidateAndJob(candidate.id, job.id);
    if (!existingApp) {
      await Application.create({
        candidate_id: candidate.id,
        job_id: job.id
      });
    }
  }
}

async function handleApplicationUpdate(data) {
  // Handle application status update
}

module.exports = router;