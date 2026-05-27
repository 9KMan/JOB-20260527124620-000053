const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'ats_platform',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
});

async function runMigrations() {
  const migrationsDir = __dirname;

  try {
    // Create migrations tracking table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const applied = await pool.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await pool.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    }

    console.log('All migrations complete');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
