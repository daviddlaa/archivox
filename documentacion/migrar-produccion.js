/**
 * Migración: Agregar columna solicitudes_ids a gestiones_maestro
 * 
 * Ejecutar con: node migrar-produccion.js
 * 
 * Lee DATABASE_URL del .env.template y se conecta a PostgreSQL
 * para agregar la columna, migrar IDs existentes y limpiar basura.
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Leer DATABASE_URL desde .env.template si no está en variables de entorno
let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    try {
        const envTemplate = fs.readFileSync(path.join(__dirname, '.env.template'), 'utf8');
        const match = envTemplate.match(/DATABASE_URL=(.+)/);
        if (match) {
            DATABASE_URL = match[1].trim();
            console.log('[INFO] DATABASE_URL leída desde .env.template');
        }
    } catch (err) {
        console.error('[ERROR] No se pudo leer .env.template:', err.message);
        process.exit(1);
    }
}

if (!DATABASE_URL) {
    console.error('[ERROR] No se encontró DATABASE_URL en .env.template ni en variables de entorno');
    process.exit(1);
}

console.log('============================================');
console.log(' Migración: Agregar solicitudes_ids a');
console.log(' gestiones_maestro en PostgreSQL (Render)');
console.log('============================================\n');

async function main() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // --- PASO 1 ---
        console.log('[1/3] Agregando columna solicitudes_ids...');
        await pool.query(`
            ALTER TABLE gestiones_maestro 
            ADD COLUMN IF NOT EXISTS solicitudes_ids TEXT;
        `);
        console.log('[OK] Columna agregada.\n');

        // --- PASO 2 ---
        console.log('[2/3] Migrando IDs de solicitudes existentes...');
        const resultMigrate = await pool.query(`
            UPDATE gestiones_maestro gm
            SET solicitudes_ids = (
                SELECT COALESCE(
                    '[' || string_agg(DISTINCT g.solicitud_id::text, ',' ORDER BY g.solicitud_id::text) || ']',
                    '[]'
                )
                FROM gestiones g
                WHERE g.gestion_maestro_id = gm.id
            )
            WHERE gm.solicitudes_ids IS NULL;
        `);
        console.log('[OK] IDs migrados. Filas afectadas:', resultMigrate.rowCount, '\n');

        // --- PASO 3 ---
        console.log('[3/3] Eliminando registros basura \'Pendiente/Por gestionar\'...');
        const resultClean = await pool.query(`
            DELETE FROM gestiones
            WHERE tipo_gestion = 'Pendiente'
              AND observacion = 'Por gestionar'
              AND gestion_maestro_id IS NOT NULL;
        `);
        console.log('[OK] Registros basura eliminados:', resultClean.rowCount, '\n');

        // --- VERIFICACIÓN ---
        console.log('============================================');
        console.log(' VERIFICACIÓN');
        console.log('============================================');
        const verifyResult = await pool.query(`
            SELECT id, nombre, total_solicitudes, solicitudes_ids 
            FROM gestiones_maestro 
            ORDER BY id DESC 
            LIMIT 5;
        `);
        
        if (verifyResult.rows.length === 0) {
            console.log('(No hay campañas en la base de datos)');
        } else {
            console.log('Últimas 5 campañas migradas:');
            verifyResult.rows.forEach(row => {
                console.log(`  #${row.id} - ${row.nombre || 'Sin nombre'}: ${row.total_solicitudes} solicitudes - IDs: ${row.solicitudes_ids}`);
            });
        }

        console.log('\n============================================');
        console.log(' Migración completada exitosamente!');
        console.log('============================================');

    } catch (err) {
        console.error('[ERROR] Falló la migración:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
