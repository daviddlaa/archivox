// Unified database helper - works with both SQLite and PostgreSQL
require('dotenv').config();

let db;
let pool;

// If DATABASE_URL exists, use PostgreSQL, otherwise use SQLite
if (process.env.DATABASE_URL) {
    console.log('Using PostgreSQL database (production)');
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    // Export pool directly for controllers expecting pool.query()
    db = pool;
} else {
    console.log('Using SQLite database (local)');
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.join(__dirname, '../../database.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    // For compatibility, provide query as alias to prepare/run
    pool = {
        query: (sql, params) => {
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return Promise.resolve(db.prepare(sql).all(...(params || [])));
            }
            return Promise.resolve(db.prepare(sql).run(...(params || [])));
        }
    };
}

module.exports = db;
module.exports.pool = pool;
