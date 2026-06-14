// Módulo unificado de base de datos
// Automático: PostgreSQL en producción (Render), SQLite localmente
// Interfaz unificada compatible con ambos gestores

if (process.env.DATABASE_URL) {
    // Producción: PostgreSQL - interfaz directa
    const pool = require('./database.pg.js');
    module.exports = {
        query: (text, params) => pool.query(text, params),
        connect: () => pool.connect()
    };
} else {
    // Local: SQLite - envolver para interfaz compatible
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.join(__dirname, '../../database.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    // Interfaz compatible con PostgreSQL (pool)
    module.exports = {
        query: (text, params) => {
            return new Promise((resolve, reject) => {
                try {
                    let sql = text;
                    let paramArray = params || [];
                    
                    //替换 PostgreSQL 语法为 SQLite
                    sql = sql.replace(/TO_CHAR\([^,]+,\s*['"]YYYY-MM['"]\)/gi, 'strftime("%Y-%m", $1)');
                    sql = sql.replace(/TO_CHAR\([^,]+,\s*['"]Mon YYYY['"]\)/gi, 'strftime("%b %Y", $1)');
                    sql = sql.replace(/CURRENT_DATE\s*-\s*INTERVAL\s*'([^']+)'/gi, function(match, interval) {
                        const days = parseInt(interval) || interval;
                        if (interval.includes('days') || interval.includes('day')) {
                            return "date('now', '-" + interval.replace(/days/g,'').replace(/day/g,'') + " days')";
                        } else if (interval.includes('months') || interval.includes('month')) {
                            return "date('now', '-" + interval.replace(/months/g,'').replace(/month/g,'') + " months')";
                        } else if (interval.includes('years') || interval.includes('year')) {
                            return "date('now', '-" + interval.replace(/years/g,'').replace(/year/g,'') + " years')";
                        }
                        return "date('now', '-" + days + " days')";
                    });
                    sql = sql.replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");
                    sql = sql.replace(/\$[0-9]+/g, '?');
                    
                    const stmt = db.prepare(sql);
                    
                    if (sql.trim().toUpperCase().startsWith('SELECT')) {
                        const rows = paramArray.length > 0 ? stmt.all(...paramArray) : stmt.all();
                        resolve({ rows: rows || [] });
                    } else {
                        const result = paramArray.length > 0 ? stmt.run(...paramArray) : stmt.run();
                        resolve({ 
                            rows: result.lastInsertRowid ? [{ id: result.lastInsertRowid }] : [],
                            rowCount: result.changes
                        });
                    }
                } catch (err) {
                    console.error('SQLite Error:', err.message);
                    console.error('Query:', text);
                    resolve({ rows: [], rowCount: 0 });
                }
            });
        },
        connect: () => {
            return {
                query: (text, params) => module.exports.query(text, params),
                release: () => {}
            };
        }
    };
}
