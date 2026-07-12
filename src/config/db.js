// Unified database helper - works with both SQLite and PostgreSQL
require('dotenv').config();

let pool;

// If DATABASE_URL exists, use PostgreSQL, otherwise use SQLite
if (process.env.DATABASE_URL) {
    console.log('Using PostgreSQL database (production)');
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,                    // Máximo 20 conexiones concurrentes
        idleTimeoutMillis: 30000,   // Cerrar conexiones inactivas después de 30s
        connectionTimeoutMillis: 5000, // Timeout de conexión: 5s
    });

    // Monitoreo básico del pool (cada 5 min en producción)
    if (process.env.NODE_ENV === 'production') {
        setInterval(() => {
            console.log('[Pool] total:', pool.totalCount, 'idle:', pool.idleCount, 'waiting:', pool.waitingCount);
        }, 300000);
    }

    // Wrap the pool to convert SQLite ? placeholders to PostgreSQL $N placeholders
    const originalQuery = pool.query.bind(pool);
    pool.query = (sql, params) => {
        const queryParams = params || [];
        
        // Convert SQLite ? placeholders to PostgreSQL $1, $2, $3... for PostgreSQL
        // This handles queries written with SQLite syntax but executed on PostgreSQL
        let pgSql = sql;
        if (sql.includes('?')) {
            let paramIndex = 1;
            pgSql = sql.replace(/\?/g, () => '$' + paramIndex++);
            console.log('[DB] Converting SQL placeholders:', sql.substring(0, 50).replace(/\s+/g, ' '), '->', pgSql.substring(0, 50).replace(/\s+/g, ' '));
        }
        
        // Auto-add RETURNING id for INSERT queries so we can return lastInsertRowid
        // PostgreSQL's query() doesn't have lastInsertRowid like SQLite
        const trimmed = pgSql.trim().toUpperCase();
        if (trimmed.startsWith('INSERT') && !trimmed.includes('RETURNING')) {
            pgSql += ' RETURNING id';
            console.log('[DB] Added RETURNING id to INSERT:', pgSql.substring(0, 80).replace(/\s+/g, ' '));
        }
        
        return originalQuery(pgSql, queryParams).then(function(result) {
            // Extract lastInsertRowid from RETURNING id for compatibility
            if (result.rows && result.rows.length > 0 && result.rows[0].id != null) {
                result.lastInsertRowid = result.rows[0].id;
            }
            return result;
        });
    };
} else {
    console.log('Using SQLite database (local)');
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.join(__dirname, '../../database.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    // Create a wrapper that mimics PostgreSQL's pool.query() interface
    // Convert PostgreSQL placeholders and syntax to SQLite
    pool = {
        query: (sql, params) => {
            // params should be an array - if undefined, use empty array
            const queryParams = params || [];
            
            // Store original SQL for reference
            let sqliteSql = sql;
            
            // Convert $1, $2, $3... to ?, ?, ?...
            sqliteSql = sqliteSql.replace(/\$(\d+)/g, '?');
            
            // Convert INTERVAL syntax (PostgreSQL) to SQLite date functions
            // CURRENT_DATE - INTERVAL 'X days' -> datetime('now', '-X days')
            sqliteSql = sqliteSql.replace(/CURRENT_DATE\s*-\s*INTERVAL\s+'(\d+)\s*days'/gi, 
                "datetime('now', '-' || '$1' || ' days')");
            sqliteSql = sqliteSql.replace(/CURRENT_DATE\s*-\s*INTERVAL\s+'(\d+)\s*months'/gi, 
                "datetime('now', '-' || '$1' || ' months')");
            // CURRENT_TIMESTAMP + INTERVAL 'X minutes' -> datetime('now', '+X minutes')
            sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP\s*\+\s*INTERVAL\s+'(\d+)\s*minutes'/gi, 
                "datetime('now', '+' || '$1' || ' minutes')");
            // CURRENT_TIMESTAMP + INTERVAL 'X hours' -> datetime('now', '+X hours')
            sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP\s*\+\s*INTERVAL\s+'(\d+)\s*hours'/gi, 
                "datetime('now', '+' || '$1' || ' hours')");
            // CURRENT_TIMESTAMP + INTERVAL 'X days' -> datetime('now', '+X days')
            sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP\s*\+\s*INTERVAL\s+'(\d+)\s*days'/gi, 
                "datetime('now', '+' || '$1' || ' days')");
            // CURRENT_TIMESTAMP - INTERVAL 'X days' -> datetime('now', '-X days')
            sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s+'(\d+)\s*days'/gi, 
                "datetime('now', '-' || '$1' || ' days')");
            // CURRENT_TIMESTAMP - INTERVAL 'X hours' -> datetime('now', '-X hours')
            sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s+'(\d+)\s*hours'/gi, 
                "datetime('now', '-' || '$1' || ' hours')");
            // CURRENT_TIMESTAMP - INTERVAL 'X minutes' -> datetime('now', '-X minutes')
            sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s+'(\d+)\s*minutes'/gi, 
                "datetime('now', '-' || '$1' || ' minutes')");
            
            // Convert TO_CHAR(fecha_solicitud, 'YYYY-MM') to strftime
            sqliteSql = sqliteSql.replace(/TO_CHAR\([^,]+,\s*'YYYY-MM'\)/gi, 
                "strftime('%Y-%m', fecha_solicitud)");
            sqliteSql = sqliteSql.replace(/TO_CHAR\([^,]+,\s*'Mon YYYY'\)/gi, 
                "strftime('%b %Y', fecha_solicitud)");
            
            // Convert COALESCE to IFNULL for SQLite
            sqliteSql = sqliteSql.replace(/COALESCE\(([^,]+),\s*'([^']*)'\)/gi, 
                "IFNULL($1, '')");
            
            // DEBUG logging
            if (sql.includes('SELECT') || sql.includes('FROM')) {
                console.log('DEBUG: Converting SQL:', sql.substring(0, 60), '->', sqliteSql.substring(0, 60));
            }
            
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                try {
                    const rows = db.prepare(sqliteSql).all(...queryParams);
                    return Promise.resolve({ rows: rows });
                } catch (err) {
                    console.error('SQLite query error:', err.message);
                    console.error('SQL:', sqliteSql);
                    return Promise.resolve({ rows: [] });
                }
            }
            
            // Check if query has RETURNING clause
            if (/\bRETURNING\b/i.test(sqliteSql)) {
                try {
                    const rows = db.prepare(sqliteSql).all(...queryParams);
                    var rowId = rows && rows.length > 0 && rows[0].id != null ? rows[0].id : null;
                    return Promise.resolve({ 
                        rows: rows,
                        rowCount: rows.length,
                        lastInsertRowid: rowId
                    });
                } catch (err) {
                    console.error('SQLite RETURNING error:', err.message);
                    return Promise.resolve({ rows: [], rowCount: 0 });
                }
            }
            
            try {
                const result = db.prepare(sqliteSql).run(...queryParams);
                // Return in same format as PostgreSQL
                return Promise.resolve({ 
                    rows: [], 
                    rowCount: result.changes,
                    lastInsertRowid: result.lastInsertRowid 
                });
            } catch (err) {
                console.error('SQLite exec error:', err.message);
                return Promise.resolve({ rows: [], rowCount: 0 });
            }
        }
    };
}

// Export pool for use as database connection
module.exports = pool;
