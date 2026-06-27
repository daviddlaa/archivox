// Unified database helper - works with both SQLite and PostgreSQL
require('dotenv').config();

let db;

// If DATABASE_URL exists, use PostgreSQL, otherwise use SQLite
if (process.env.DATABASE_URL) {
    console.log('Using PostgreSQL database (production)');
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    // Wrapper for PostgreSQL to match better-sqlite3 API
    db = {
        prepare: (sql) => ({
            all: (...params) => pool.query(sql, params).then(r => r.rows),
            get: (...params) => pool.query(sql, params).then(r => r.rows[0]),
            run: (...params) => pool.query(sql, params).then(r => ({ lastInsertRowid: r.rows[0]?.id }))
        }),
        exec: (sql) => pool.query(sql)
    };
    db.pool = pool;
} else {
    console.log('Using SQLite database (local)');
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.join(__dirname, '../../database.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
}

module.exports = db;
