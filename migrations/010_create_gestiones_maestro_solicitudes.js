const db = require('../src/config/db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function getRows(result) {
    if (result && result.rows) return result.rows;
    return result || [];
}

async function up() {
    console.log('  MIGRACIÓN 010: Tabla puente gestiones_maestro_solicitudes (semáforo)');

    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS gestiones_maestro_solicitudes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gestion_maestro_id INTEGER NOT NULL,
                id_solicitud INTEGER NOT NULL,
                semaforo TEXT NOT NULL DEFAULT 'sin_clasificar',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                UNIQUE (gestion_maestro_id, id_solicitud)
            )
        `);
        console.log('   ✅ Tabla gestiones_maestro_solicitudes creada (o ya existía)');
    } catch (error) {
        // PostgreSQL: SERIAL en lugar de AUTOINCREMENT
        if (error.message && (error.message.includes('AUTOINCREMENT') || error.message.includes('syntax'))) {
            await db.query(`
                CREATE TABLE IF NOT EXISTS gestiones_maestro_solicitudes (
                    id SERIAL PRIMARY KEY,
                    gestion_maestro_id INTEGER NOT NULL,
                    id_solicitud INTEGER NOT NULL,
                    semaforo TEXT NOT NULL DEFAULT 'sin_clasificar',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_by INTEGER,
                    UNIQUE (gestion_maestro_id, id_solicitud)
                )
            `);
            console.log('   ✅ Tabla gestiones_maestro_solicitudes creada (PostgreSQL)');
        } else if (error.message && error.message.includes('already exists')) {
            console.log('   ℹ️ Tabla ya existe');
        } else {
            throw error;
        }
    }

    try {
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_gms_maestro_semaforo
            ON gestiones_maestro_solicitudes (gestion_maestro_id, semaforo)
        `);
        console.log('   ✅ Índice idx_gms_maestro_semaforo');
    } catch (e) {
        console.log('   ℹ️ Índice:', e.message);
    }

    try {
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_gms_solicitud
            ON gestiones_maestro_solicitudes (id_solicitud)
        `);
        console.log('   ✅ Índice idx_gms_solicitud');
    } catch (e) {
        console.log('   ℹ️ Índice solicitud:', e.message);
    }

    // Backfill: todas las solicitudes actuales de cada campaña → sin_clasificar
    console.log('   ⏳ Backfill sin_clasificar desde solicitudes_ids...');
    const resultGM = await db.query('SELECT id, solicitudes_ids FROM gestiones_maestro');
    const campañas = getRows(resultGM);
    var insertados = 0;
    var omitidos = 0;

    for (var i = 0; i < campañas.length; i++) {
        var gm = campañas[i];
        var ids = [];
        try {
            if (gm.solicitudes_ids) {
                ids = JSON.parse(gm.solicitudes_ids);
            }
        } catch (e) {
            console.log('   ⚠️ Campaña', gm.id, 'solicitudes_ids inválido');
            continue;
        }
        if (!Array.isArray(ids) || ids.length === 0) continue;

        for (var j = 0; j < ids.length; j++) {
            var sid = Number(ids[j]);
            if (!sid || isNaN(sid)) continue;

            try {
                var exists = await db.query(
                    'SELECT id FROM gestiones_maestro_solicitudes WHERE gestion_maestro_id = ? AND id_solicitud = ?',
                    [gm.id, sid]
                );
                var row = (exists && exists.rows && exists.rows[0]) || (Array.isArray(exists) && exists[0]) || null;
                if (row) {
                    omitidos++;
                    continue;
                }
                await db.query(
                    `INSERT INTO gestiones_maestro_solicitudes (gestion_maestro_id, id_solicitud, semaforo)
                     VALUES (?, ?, 'sin_clasificar')`,
                    [gm.id, sid]
                );
                insertados++;
            } catch (e) {
                omitidos++;
            }
        }
    }

    console.log('   ✅ Backfill: insertados=' + insertados + ', omitidos/ya existían=' + omitidos);
    console.log('  MIGRACIÓN 010 completada');
}

async function down() {
    console.log('⚠️ Rollback 010: DROP gestiones_maestro_solicitudes');
    try {
        await db.query('DROP TABLE IF EXISTS gestiones_maestro_solicitudes');
    } catch (e) {
        console.error(e);
    }
}

if (require.main === module) {
    up().then(function() { process.exit(0); }).catch(function(err) {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { up, down };
