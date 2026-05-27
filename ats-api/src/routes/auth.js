const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const PortalConfig = require('../models/portalConfig');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// POST /api/auth/login
router.post('/login',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // For demo purposes, accept any valid email/password
      // In production, verify against database
      const { email, password } = req.body;

      const token = jwt.sign(
        { email, role: 'user' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: { email }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/oauth/naukri - Initiate Naukri OAuth
router.post('/oauth/naukri', async (req, res) => {
  try {
    const portalConfig = await PortalConfig.findByPortalName('naukri');
    if (!portalConfig) {
      return res.status(404).json({ error: 'Naukri portal not configured' });
    }

    const clientId = PortalConfig.decrypt(portalConfig.api_key_encrypted);
    const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:4000'}/api/auth/oauth/naukri/callback`;

    const authUrl = `https://www.naukri.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

    res.json({ auth_url: authUrl });
  } catch (error) {
    console.error('OAuth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth' });
  }
});

// GET /api/auth/oauth/naukri/callback - OAuth callback handler
router.get('/oauth/naukri/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const portalConfig = await PortalConfig.findByPortalName('naukri');
    const clientId = PortalConfig.decrypt(portalConfig.api_key_encrypted);
    const clientSecret = PortalConfig.decrypt(portalConfig.oauth_secret_encrypted);

    // Exchange code for token
    const tokenResponse = await axios.post(
      'https://www.naukri.com/oauth2/token',
      {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
      },
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Store token
    await PortalConfig.upsert('naukri', {
      oauth_token: tokenResponse.data.access_token,
    });

    res.json({ message: 'Naukri OAuth successful', success: true });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'OAuth authentication failed' });
  }
});

module.exports = router;