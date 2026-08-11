// ============================================================================
// SERVICIO DE DUMP / BACKUP DE BASE DE DATOS
// ============================================================================
// Genera un respaldo SQL completo y portable de la base de datos activa
// (PostgreSQL en producción o SQLite en local) usando la interfaz unificada
// de db.js. El archivo resultante se puede restaurar con psql (PostgreSQL)
// o con el cliente de SQLite (sqlite3 < dump.sql).
// ============================================================================

const pool = require('../config/db');

const esPostgres = !!process.env.DATABASE_URL;

// Cita un identificador (nombre de tabla/columna) de forma segura.
function qid(name) {
    return '"' + String(name).replace(/"/g, '""') + '"';
}

// Escapa un valor para usarlo como literal SQL.
function escapeLiteral(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) return "'" + val.toISOString() + "'";
    if (Buffer.isBuffer(val)) {
        return esPostgres
            ? `decode('${val.toString('hex')}', 'hex')::bytea`
            : `X'${val.toString('hex')}'`;
    }
    if (typeof val === 'object') {
        // Columnas json/jsonb llegan como objetos JS (p. ej. audit_log.detalle).
        return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
    }
    return "'" + String(val).replace(/'/g, "''") + "'";
}

// ============================================================================
// Dump PostgreSQL
// ============================================================================

function mapearTipoPG(col) {
    const dt = col.data_type;
    const n = col.character_maximum_length;
    const p = col.numeric_precision;
    const s = col.numeric_scale;
    switch (dt) {
        case 'character varying': return 'VARCHAR' + (n ? '(' + n + ')' : '');
        case 'character': return 'CHAR' + (n ? '(' + n + ')' : '');
        case 'integer': return 'INTEGER';
        case 'bigint': return 'BIGINT';
        case 'smallint': return 'SMALLINT';
        case 'numeric': return 'NUMERIC' + (p != null ? '(' + p + (s != null ? ',' + s : '') + ')' : '');
        case 'real': return 'REAL';
        case 'double precision': return 'DOUBLE PRECISION';
        case 'boolean': return 'BOOLEAN';
        case 'date': return 'DATE';
        case 'timestamp without time zone': return 'TIMESTAMP';
        case 'timestamp with time zone': return 'TIMESTAMPTZ';
        case 'time without time zone': return 'TIME';
        case 'text': return 'TEXT';
        case 'json': return 'JSON';
        case 'jsonb': return 'JSONB';
        case 'bytea': return 'BYTEA';
        default: return String(dt).toUpperCase();
    }
}

async function generarDumpPostgres() {
    const lineas = [];
    lineas.push('-- ============================================================');
    lineas.push('-- Archivox PostgreSQL dump');
    lineas.push('-- Generado: ' + new Date().toISOString());
    lineas.push('-- Restaurar: psql <TU_DATABASE_URL> < archivox_dump.sql');
    lineas.push('-- ============================================================');
    lineas.push('BEGIN;');
    lineas.push('');

    const tablas = await pool.query(`
        SELECT table_name AS nombre
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `);
    const nombres = tablas.rows.map(r => r.nombre);

    // -------- ESQUEMA: CREATE TABLE (columnas + PK; FK al final) --------
    lineas.push('-- ============ ESQUEMA ============');
    lineas.push('');
    for (const nombre of nombres) {
        const cols = await pool.query(`
            SELECT column_name AS nombre, data_type, character_maximum_length,
                   numeric_precision, numeric_scale, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position
        `, [nombre]);

        const pks = await pool.query(`
            SELECT kcu.column_name AS nombre
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
             AND tc.table_name = kcu.table_name
            WHERE tc.table_schema = 'public' AND tc.table_name = $1
              AND tc.constraint_type = 'PRIMARY KEY'
            ORDER BY kcu.ordinal_position
        `, [nombre]);

        const pkSet = new Set(pks.rows.map(r => r.nombre));
        const defs = cols.rows.map((c) => {
            const esSerial = typeof c.column_default === 'string' && /^nextval\(/.test(c.column_default);
            if (esSerial && (c.data_type === 'integer' || c.data_type === 'bigint')) {
                return qid(c.nombre) + ' SERIAL';
            }
            let def = qid(c.nombre) + ' ' + mapearTipoPG(c);
            if (c.column_default != null) {
                def += ' DEFAULT ' + c.column_default;
            }
            if (c.is_nullable === 'NO') def += ' NOT NULL';
            return def;
        });
        if (pkSet.size) {
            const pkCols = pks.rows.map(r => qid(r.nombre)).join(', ');
            defs.push('PRIMARY KEY (' + pkCols + ')');
        }

        // Constraints UNIQUE (necesarios para que las FKs referencien columnas válidas)
        const uniqCols = await pool.query(`
            SELECT tc.constraint_name AS cname, kcu.column_name AS col
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
             AND tc.table_name = kcu.table_name
            WHERE tc.table_schema = 'public' AND tc.table_name = $1
              AND tc.constraint_type = 'UNIQUE'
            ORDER BY tc.constraint_name, kcu.ordinal_position
        `, [nombre]);
        const uniqMap = new Map();
        for (const u of uniqCols.rows) {
            if (!uniqMap.has(u.cname)) uniqMap.set(u.cname, []);
            uniqMap.get(u.cname).push(u.col);
        }
        for (const colsUniq of uniqMap.values()) {
            defs.push('UNIQUE (' + colsUniq.map(qid).join(', ') + ')');
        }

        lineas.push('CREATE TABLE IF NOT EXISTS ' + qid(nombre) + ' (');
        lineas.push('    ' + defs.join(',\n    '));
        lineas.push(');');
        lineas.push('');
    }

    // -------- DATOS --------
    lineas.push('-- ============ DATOS ============');
    lineas.push('');
    for (const nombre of nombres) {
        const cols = await pool.query(`
            SELECT column_name AS nombre
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position
        `, [nombre]);
        const colNames = cols.rows.map(r => r.nombre);
        if (!colNames.length) continue;

        const data = await pool.query(
            'SELECT ' + colNames.map(qid).join(', ') + ' FROM ' + qid(nombre)
        );
        for (const row of data.rows) {
            const valores = colNames.map(c => escapeLiteral(row[c]));
            lineas.push(
                'INSERT INTO ' + qid(nombre) +
                ' (' + colNames.map(qid).join(', ') + ') VALUES (' +
                valores.join(', ') + ');'
            );
        }
        lineas.push('');
    }

    // -------- SECUENCIAS (SERIAL) --------
    const secuencias = await pool.query(`
        SELECT table_name AS tabla, column_name AS col
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_default LIKE 'nextval%'
        ORDER BY table_name, ordinal_position
    `);
    if (secuencias.rows.length) {
        lineas.push('-- ============ SECUENCIAS ============');
        lineas.push('');
        for (const s of secuencias.rows) {
            lineas.push(
                "SELECT setval(pg_get_serial_sequence(" + escapeLiteral(s.tabla) +
                ", " + escapeLiteral(s.col) + "), " +
                'COALESCE((SELECT MAX(' + qid(s.col) + ') FROM ' + qid(s.tabla) + '), 1));'
            );
        }
        lineas.push('');
    }

    // -------- CLAVES FORÁNEAS (al final, tras los datos) --------
    const fks = await pool.query(`
        SELECT tc.table_name AS origen, tc.constraint_name AS nombre,
               kcu.column_name AS col_origen,
               ccu.table_name AS destino, ccu.column_name AS col_destino
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
    `);
    const fkMap = new Map();
    for (const f of fks.rows) {
        const key = f.origen + '.' + f.nombre;
        if (!fkMap.has(key)) {
            fkMap.set(key, {
                origen: f.origen,
                nombre: f.nombre,
                destino: f.destino,
                cols: [],
                refs: []
            });
        }
        fkMap.get(key).cols.push(f.col_origen);
        fkMap.get(key).refs.push(f.col_destino);
    }
    if (fkMap.size) {
        lineas.push('-- ============ CLAVES FORÁNEAS ============');
        lineas.push('');
        for (const fk of fkMap.values()) {
            lineas.push(
                'ALTER TABLE ' + qid(fk.origen) + ' ADD CONSTRAINT ' + qid(fk.nombre) +
                ' FOREIGN KEY (' + fk.cols.map(qid).join(', ') + ')' +
                ' REFERENCES ' + qid(fk.destino) + ' (' + fk.refs.map(qid).join(', ') + ');'
            );
        }
        lineas.push('');
    }

    lineas.push('COMMIT;');
    return lineas.join('\n') + '\n';
}

// ============================================================================
// Dump SQLite
// ============================================================================

async function generarDumpSQLite() {
    const lineas = [];
    lineas.push('-- ============================================================');
    lineas.push('-- Archivox SQLite dump');
    lineas.push('-- Generado: ' + new Date().toISOString());
    lineas.push('-- Restaurar: sqlite3 database.db < archivox_dump.sql');
    lineas.push('-- ============================================================');
    lineas.push('PRAGMA foreign_keys = OFF;');
    lineas.push('BEGIN TRANSACTION;');
    lineas.push('');

    const tablas = await pool.query(`
        SELECT name AS nombre, sql AS ddl
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY rowid
    `);

    for (const t of tablas.rows) {
        if (t.ddl) {
            lineas.push(t.ddl + ';');
            lineas.push('');
        }

        // PRAGMA no es enrutable por el wrapper de db.js (solo manda a .all()
        // consultas SELECT), así que usamos la función de tabla pragma_table_info.
        const cols = await pool.query(
            'SELECT name FROM pragma_table_info(' + escapeLiteral(t.nombre) + ')'
        );
        const colNames = cols.rows.map(c => c.name);
        if (!colNames.length) continue;

        const data = await pool.query(
            'SELECT ' + colNames.map(qid).join(', ') + ' FROM ' + qid(t.nombre)
        );
        for (const row of data.rows) {
            const valores = colNames.map(c => escapeLiteral(row[c]));
            lineas.push(
                'INSERT INTO ' + qid(t.nombre) +
                ' (' + colNames.map(qid).join(', ') + ') VALUES (' +
                valores.join(', ') + ');'
            );
        }
        lineas.push('');
    }

    lineas.push('COMMIT;');
    lineas.push('PRAGMA foreign_keys = ON;');
    return lineas.join('\n') + '\n';
}

// ============================================================================
// Dispatcher público
// ============================================================================

/**
 * Genera el dump completo de la base de datos activa.
 * @returns {Promise<string>} SQL listo para descargar.
 */
async function generarDump() {
    if (esPostgres) {
        return generarDumpPostgres();
    }
    return generarDumpSQLite();
}

/**
 * Nombre de motor actual (para el panel/UI).
 */
function motorBD() {
    return esPostgres ? 'postgres' : 'sqlite';
}

module.exports = {
    generarDump,
    motorBD
};
