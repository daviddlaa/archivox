// Script to apply migration: add gestion_maestro_id to gestiones (Postgres and SQLite)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbModule = require('../src/config/db');
const pool = dbModule.pool || dbModule;

async function run() {
    try {
        if (process.env.DATABASE_URL) {
            console.log('Detected PostgreSQL (DATABASE_URL). Applying Postgres migration...');

            // Add column if not exists
            await pool.query(`ALTER TABLE gestiones ADD COLUMN IF NOT EXISTS gestion_maestro_id INTEGER;`);

            // Add FK only if constraint does not exist
            await pool.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_gestion_maestro') THEN
    ALTER TABLE gestiones ADD CONSTRAINT fk_gestion_maestro FOREIGN KEY (gestion_maestro_id) REFERENCES gestiones_maestro(id);
  END IF;
END$$;`);

            console.log('Postgres migration applied successfully.');
        } else {
            console.log('No DATABASE_URL detected — assuming SQLite. Applying SQLite migration...');

            // Check if column exists (use SELECT from pragma_table_info so db.pool treats as SELECT)
            const cols = await pool.query("SELECT name FROM pragma_table_info('gestiones')");
            const hasCol = Array.isArray(cols) && cols.some(c => c.name === 'gestion_maestro_id');

            if (hasCol) {
                console.log('SQLite: column gestion_maestro_id already exists. Nothing to do.');
            } else {
                console.log('SQLite: adding column gestion_maestro_id to gestiones...');
                await pool.query('ALTER TABLE gestiones ADD COLUMN gestion_maestro_id INTEGER;');
                console.log('SQLite: column added. Note: SQLite does not support adding FK constraints to existing tables.');
            }
        }
    } catch (err) {
        console.error('Migration error:', err.message || err);
        process.exitCode = 1;
    }
}

run();
