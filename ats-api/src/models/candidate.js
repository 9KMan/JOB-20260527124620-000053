const { Pool } = require('pg');
const pool = require('../config/database');

class Candidate {
  static async findAll({ page = 1, limit = 50, skills, source, search }) {
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    let paramCount = 0;

    if (skills) {
      paramCount++;
      where.push(`skills @> $${paramCount}::text[]`);
      params.push(skills.split(','));
    }
    if (source) {
      paramCount++;
      where.push(`source = $${paramCount}`);
      params.push(source);
    }
    if (search) {
      paramCount++;
      where.push(`(name ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM candidates ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, email, phone, name, location, current_title, years_experience,
             skills, source, portal_id, created_at, updated_at
      FROM candidates
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT id, email, phone, name, location, current_title, years_experience,
              skills, source, portal_id, created_at, updated_at
       FROM candidates WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM candidates WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  static async create(data) {
    const { email, phone, name, location, current_title, years_experience, skills, source, portal_id } = data;
    const result = await pool.query(
      `INSERT INTO candidates (email, phone, name, location, current_title, years_experience, skills, source, portal_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [email, phone, name, location, current_title, years_experience, skills || [], source, portal_id]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['email', 'phone', 'name', 'location', 'current_title', 'years_experience', 'skills', 'source'];
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
      `UPDATE candidates SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM candidates WHERE id = $1', [id]);
    return true;
  }
}

module.exports = Candidate;
