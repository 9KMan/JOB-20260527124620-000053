const pool = require('../config/database');

class Application {
  static async findAll({ page = 1, limit = 50, candidate_id, job_id, stage }) {
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    let paramCount = 0;

    if (candidate_id) {
      paramCount++;
      where.push(`candidate_id = $${paramCount}`);
      params.push(candidate_id);
    }
    if (job_id) {
      paramCount++;
      where.push(`job_id = $${paramCount}`);
      params.push(job_id);
    }
    if (stage) {
      paramCount++;
      where.push(`stage = $${paramCount}`);
      params.push(stage);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM applications ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;

    const result = await pool.query(
      `SELECT a.*, c.name as candidate_name, c.email as candidate_email,
              j.title as job_title
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       ${whereClause}
       ORDER BY a.applied_at DESC
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
      `SELECT a.*, c.name as candidate_name, c.email as candidate_email,
              j.title as job_title
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async create(data) {
    const { candidate_id, job_id, notes } = data;
    const result = await pool.query(
      `INSERT INTO applications (candidate_id, job_id, notes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [candidate_id, job_id, notes]
    );
    return result.rows[0];
  }

  static async updateStage(id, stage) {
    const result = await pool.query(
      `UPDATE applications
       SET stage = $1, last_stage_change = NOW()
       WHERE id = $2
       RETURNING *`,
      [stage, id]
    );
    return result.rows[0];
  }

  static async findByCandidateAndJob(candidateId, jobId) {
    const result = await pool.query(
      'SELECT * FROM applications WHERE candidate_id = $1 AND job_id = $2',
      [candidateId, jobId]
    );
    return result.rows[0] || null;
  }
}

module.exports = Application;
