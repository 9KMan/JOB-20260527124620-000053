const axios = require('axios');
const PortalConfig = require('../models/portalConfig');
const SyncLog = require('../models/syncLog');
const Candidate = require('../models/candidate');
const Job = require('../models/job');
const crypto = require('crypto');

class PortalSyncService {
  static async triggerFullSync(portalName) {
    const syncLog = await SyncLog.create({
      portal_name: portalName,
      sync_type: 'full',
      status: 'running'
    });

    try {
      switch (portalName) {
        case 'naukri':
          await this.syncNaukriJobs();
          await this.syncNaukriCandidates();
          break;
        case 'linkedin':
          await this.syncLinkedInJobs();
          break;
        default:
          throw new Error(`Unknown portal: ${portalName}`);
      }

      await PortalConfig.updateLastSync(portalName);
      await SyncLog.complete(syncLog.id, 0);
    } catch (error) {
      console.error(`Sync failed for ${portalName}:`, error);
      await SyncLog.complete(syncLog.id, 0, error.message);
      throw error;
    }
  }

  static async syncNaukriJobs() {
    const portalConfig = await PortalConfig.findByPortalName('naukri');
    if (!portalConfig || !portalConfig.is_active) {
      throw new Error('Naukri portal not configured or inactive');
    }

    const lastSync = portalConfig.last_sync_at;
    const since = lastSync ? `?since=${lastSync.toISOString()}` : '';

    const response = await axios.get(
      `${process.env.NAUKRI_API_URL}/jobs${since}`,
      {
        headers: {
          'Authorization': `Bearer ${PortalConfig.decrypt(portalConfig.oauth_token)}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const jobs = response.data.jobs || [];
    let synced = 0;

    for (const jobData of jobs) {
      try {
        const existing = await Job.findByPortalId('naukri', jobData.job_id);
        if (existing) {
          await Job.update(existing.id, {
            title: jobData.title,
            department: jobData.department,
            location: jobData.location,
            salary_range: jobData.salary_range,
            description: jobData.description,
            requirements: jobData.requirements,
            status: jobData.status
          });
        } else {
          await Job.create({
            title: jobData.title,
            department: jobData.department,
            location: jobData.location,
            employment_type: jobData.employment_type,
            portal_source: 'naukri',
            portal_job_id: jobData.job_id,
            salary_range: jobData.salary_range,
            description: jobData.description,
            requirements: jobData.requirements,
            status: jobData.status || 'active'
          });
        }
        synced++;
      } catch (e) {
        console.error(`Failed to sync job ${jobData.job_id}:`, e.message);
      }
    }

    return synced;
  }

  static async syncNaukriCandidates() {
    const portalConfig = await PortalConfig.findByPortalName('naukri');
    const oauthToken = PortalConfig.decrypt(portalConfig.oauth_token);

    const response = await axios.get(
      `${process.env.NAUKRI_API_URL}/candidates`,
      {
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const candidates = response.data.candidates || [];
    let synced = 0;

    for (const c of candidates) {
      try {
        const hash = crypto.createHash('sha256')
          .update(`${c.email}${c.phone}`)
          .digest('hex');

        const existing = await Candidate.findByEmail(c.email);
        if (!existing) {
          await Candidate.create({
            email: c.email,
            phone: c.phone,
            name: c.name,
            location: c.location,
            current_title: c.current_title,
            years_experience: c.years_experience,
            skills: c.skills || [],
            source: 'naukri',
            portal_id: c.portal_id
          });
          synced++;
        }
      } catch (e) {
        console.error(`Failed to sync candidate ${c.email}:`, e.message);
      }
    }

    return synced;
  }

  static async syncJobFromPortal(jobId) {
    const Job = require('../models/job');
    const job = await Job.findById(jobId);

    if (job.portal_source !== 'naukri') {
      throw new Error('Only Naukri portal jobs can be synced');
    }

    const portalConfig = await PortalConfig.findByPortalName('naukri');
    const oauthToken = PortalConfig.decrypt(portalConfig.oauth_token);

    const response = await axios.get(
      `${process.env.NAUKRI_API_URL}/jobs/${job.portal_job_id}`,
      {
        headers: {
          'Authorization': `Bearer ${oauthToken}`
        }
      }
    );

    const jobData = response.data;
    await Job.update(jobId, {
      title: jobData.title,
      department: jobData.department,
      location: jobData.location,
      salary_range: jobData.salary_range,
      description: jobData.description,
      requirements: jobData.requirements,
      status: jobData.status
    });

    return jobData;
  }

  static startScheduledSync() {
    const cron = require('node-cron');
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      console.log('Running scheduled portal sync...');
      try {
        await this.triggerFullSync('naukri');
      } catch (e) {
        console.error('Scheduled sync failed:', e.message);
      }
    });
  }
}

module.exports = PortalSyncService;