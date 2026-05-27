const pool = require('../config/database');

class Job {
  static async findAll({ page = 1, limit = 50, status, department, portal_source }) {
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      where.push(`status = $${paramCount}`);
      params.push(status);
    }
    if (department) {
      paramCount++;
      where.push(`department = $${paramCount}`);
      params.push(department);
    }
    if (portal_source) {
      paramCount++;
      where.push(`portal_source = $${paramCount}`);
      params.push(portal_source);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM jobs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;

    const result = await pool.query(
      `SELECT id, title, department, location, employment_type, portal_source,
              portal_job_id, salary_range, description, requirements, status, created_at, updated_at
       FROM jobs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, limit, offset]
    );

    return {
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT j.*, COUNT(a.id) as application_count
       FROM jobs j
       LEFT JOIN applications a ON a.job_id = j.id
       WHERE j.id = $1
       GROUP BY j.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async create(data) {
    const {
      title, department, location, employment_type, portal_source,
      portal_job_id, salary_range, description, requirements, status = 'active'
    } = data;

    const result = await pool.query(
      `INSERT INTO jobs (title, department, location, employment_type, portal_source, portal_job_id, salary_range, description, requirements, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [title, department, location, employment_type, portal_source, portal_job_id, salary_range, description, requirements, status]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['title', 'department', 'location', 'employment_type', 'portal_source', 'portal_job_id', 'salary_range', 'description', 'requirements', 'status'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        paramCount++;
        fields.push(`${field} = $${paramCount}`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) return null;

    paramCount++;
    values.push(id);

    const result = await pool.query(
      `UPDATE jobs SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async findByPortalId(portalSource, portalJobId) {
    const result = await pool.query(
      'SELECT * FROM jobs WHERE portal_source = $1 AND portal_job_id = $2',
      [portalSource, portalJobId]
    );
    return result.rows[0] || null;
  }
}

module.exports = Job;
