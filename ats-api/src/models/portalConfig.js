const pool = require('../config/database');
const crypto = require('crypto-js');

class PortalConfig {
  static async findByPortalName(portalName) {
    const result = await pool.query(
      'SELECT * FROM portal_configs WHERE portal_name = $1',
      [portalName]
    );
    return result.rows[0] || null;
  }

  static async upsert(portalName, data) {
    const { api_key_encrypted, oauth_token, oauth_secret_encrypted, webhook_secret, sync_interval_minutes = 15, is_active = true } = data;

    const existing = await this.findByPortalName(portalName);

    if (existing) {
      const result = await pool.query(
        `UPDATE portal_configs
         SET api_key_encrypted = COALESCE($1, api_key_encrypted),
             oauth_token = COALESCE($2, oauth_token),
             oauth_secret_encrypted = COALESCE($3, oauth_secret_encrypted),
             webhook_secret = COALESCE($4, webhook_secret),
             sync_interval_minutes = $5,
             is_active = $6,
             updated_at = NOW()
         WHERE portal_name = $7
         RETURNING *`,
        [api_key_encrypted, oauth_token, oauth_secret_encrypted, webhook_secret, sync_interval_minutes, is_active, portalName]
      );
      return result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO portal_configs (portal_name, api_key_encrypted, oauth_token, oauth_secret_encrypted, webhook_secret, sync_interval_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [portalName, api_key_encrypted, oauth_token, oauth_secret_encrypted, webhook_secret, sync_interval_minutes, is_active]
      );
      return result.rows[0];
    }
  }

  static async updateLastSync(portalName) {
    const result = await pool.query(
      `UPDATE portal_configs SET last_sync_at = NOW() WHERE portal_name = $1 RETURNING *`,
      [portalName]
    );
    return result.rows[0];
  }

  static decrypt(value) {
    if (!value) return null;
    try {
      return crypto.AES.decrypt(value, process.env.ENCRYPTION_KEY || 'default-key').toString();
    } catch {
      return value;
    }
  }
}

module.exports = PortalConfig;
