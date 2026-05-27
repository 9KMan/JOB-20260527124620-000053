const cron = require('node-cron');
const PortalSyncService = require('./portalSync');
const Candidate = require('../models/candidate');

class SchedulerService {
  static startAll() {
    this.startPortalSync();
    this.startCandidateDedup();
    console.log('All scheduled tasks started');
  }

  static startPortalSync() {
    // Sync every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      console.log('[Scheduler] Running portal sync...');
      try {
        const SyncLog = require('../models/syncLog');
        const PortalConfig = require('../models/portalConfig');

        const configs = await PortalConfig.findAll();
        for (const config of configs) {
          if (config.is_active && config.portal_name === 'naukri') {
            await PortalSyncService.triggerFullSync(config.portal_name);
          }
        }
      } catch (error) {
        console.error('[Scheduler] Portal sync error:', error.message);
      }
    });
  }

  static startCandidateDedup() {
    // Run deduplication daily at midnight
    cron.schedule('0 0 * * *', async () => {
      console.log('[Scheduler] Running candidate deduplication...');
      try {
        await this.deduplicateCandidates();
      } catch (error) {
        console.error('[Scheduler] Dedup error:', error.message);
      }
    });
  }

  static async deduplicateCandidates() {
    // Find candidates with same email and merge
    const pool = require('../config/database');
    const result = await pool.query(`
      SELECT email, COUNT(*) as count, ARRAY_AGG(id) as ids
      FROM candidates
      GROUP BY email
      HAVING COUNT(*) > 1
    `);

    for (const row of result.rows) {
      const [primaryId, ...duplicateIds] = row.ids;
      // Merge duplicates into primary - keep newest record
      for (const dupId of duplicateIds) {
        // Update applications to point to primary
        await pool.query(
          'UPDATE applications SET candidate_id = $1 WHERE candidate_id = $2',
          [primaryId, dupId]
        );
        // Delete duplicate
        await pool.query('DELETE FROM candidates WHERE id = $1', [dupId]);
      }
    }
  }
}

module.exports = SchedulerService;