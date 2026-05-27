const pool = require('../config/database');

class SyncLog {
  static async create(data) {
    const { portal_name, sync_type, status = 'running' } = data;
    const result = await pool.query(
      `INSERT INTO sync_logs (portal_name, sync_type, status, started_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [portal_name, sync_type, status]
    );
    return result.rows[0];
  }

  static async complete(id, recordsSynced, errors = null) {
    const status = errors ? 'failed' : 'success';
    const result = await pool.query(
      `UPDATE sync_logs
       SET status = $1, completed_at = NOW(), records_synced = $2, errors = $3
       WHERE id = $4
       RETURNING *`,
      [status, recordsSynced, errors, id]
    );
    return result.rows[0];
  }

  static async findByPortal(portalName, limit = 10) {
    const result = await pool.query(
      `SELECT * FROM sync_logs
       WHERE portal_name = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [portalName, limit]
    );
    return result.rows;
  }

  static async getLatestStatus() {
    const result = await pool.query(
      `SELECT DISTINCT ON (portal_name) portal_name, sync_type, status, started_at, completed_at, records_synced
       FROM sync_logs
       ORDER BY portal_name, started_at DESC`
    );
    return result.rows;
  }
}

module.exports = SyncLog;
