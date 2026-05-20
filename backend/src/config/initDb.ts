import pool from './database';

export async function initDatabase(): Promise<void> {
  try {
    const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
    console.log(`[initDb] Connected to ${rows[0].db} (${rows[0].version.split(' ').slice(0, 2).join(' ')})`);
  } catch (err) {
    console.error('[initDb] Database connection failed:', err);
    throw err;
  }
}
