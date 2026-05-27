require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const connectMongoDB = require('./config/mongodb');

// Import routes
const authRoutes = require('./routes/auth');
const candidateRoutes = require('./routes/candidates');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const portalRoutes = require('./routes/portals');
const resumeRoutes = require('./routes/resumes');
const syncRoutes = require('./routes/sync');

// Import middleware
const { standardLimiter, authLimiter, webhookLimiter } = require('./middleware/rateLimiter');
const { authMiddleware } = require('./middleware/auth');

// Import services
const SchedulerService = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', standardLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/portals', webhookLimiter);

// Health check (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/api/metrics', async (req, res) => {
  try {
    const pool = require('./config/database');
    const candidateCount = await pool.query('SELECT COUNT(*) FROM candidates');
    const jobCount = await pool.query('SELECT COUNT(*) FROM jobs');
    const applicationCount = await pool.query('SELECT COUNT(*) FROM applications');

    res.json({
      candidates: parseInt(candidateCount.rows[0].count),
      jobs: parseInt(jobCount.rows[0].count),
      applications: parseInt(applicationCount.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Auth routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/candidates', authMiddleware, candidateRoutes);
app.use('/api/jobs', authMiddleware, jobRoutes);
app.use('/api/applications', authMiddleware, applicationRoutes);
app.use('/api/portals', authMiddleware, portalRoutes);
app.use('/api/resumes', authMiddleware, resumeRoutes);
app.use('/api/sync', authMiddleware, syncRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Start scheduler
    SchedulerService.startAll();

    app.listen(PORT, () => {
      console.log(`ATS API running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;