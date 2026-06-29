/**
 * Migración: Crear tablas de Relaciones y Gestiones de Relaciones en PostgreSQL
 * 
 * Ejecutar con: node documentacion/migrar-produccion-relaciones.js
 * 
 * Lee DATABASE_URL del .env.template y se conecta a PostgreSQL
 * para crear las tablas nuevas (relaciones, gestiones_relaciones)
 * tal como están definidas en src/config/initDb.pg.js
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
console.log(' Migración: Crear tablas de Relaciones');
console.log(' en PostgreSQL (Render)');
console.log('============================================\n');

async function main() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // --- PASO 1: Crear tabla relaciones ---
        console.log('[1/3] Creando tabla relaciones...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS relaciones (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL,
                identificacion TEXT,
                cliente TEXT,
                celular TEXT,
                estado_relacion TEXT CHECK(estado_relacion IN ('ALTA','BAJA')),
                fecha_inicio_relacion DATE,
                fecha_fin_relacion DATE,
                fecha_fin_credito DATE,
                fecha_fin_fidelizacion DATE,
                proxima_baja DATE,
                motivo_ruptura TEXT,
                numero_operaciones INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        console.log('[OK] Tabla relaciones creada.\n');

        // --- PASO 2: Crear tabla gestiones_relaciones ---
        console.log('[2/3] Creando tabla gestiones_relaciones...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gestiones_relaciones (
                id SERIAL PRIMARY KEY,
                relacion_id INTEGER NOT NULL,
                usuario_id INTEGER NOT NULL,
                tipo_gestion TEXT NOT NULL,
                observacion TEXT,
                fecha_gestion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (relacion_id) REFERENCES relaciones(id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            )
        `);
        console.log('[OK] Tabla gestiones_relaciones creada.\n');

        // --- PASO 3: Crear índice en gestiones_relaciones ---
        console.log('[3/3] Creando índices...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_gestiones_relaciones_relacion_id 
            ON gestiones_relaciones(relacion_id)
        `);
        console.log('[OK] Índices creados.\n');

        // --- VERIFICACIÓN ---
        console.log('============================================');
        console.log(' VERIFICACIÓN');
        console.log('============================================');
        
        const verifyRelaciones = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'relaciones'
            ) as existe
        `);
        console.log('✔ Tabla "relaciones":', verifyRelaciones.rows[0].existe ? 'EXISTE ✅' : 'NO EXISTE ❌');

        const verifyGestiones = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'gestiones_relaciones'
            ) as existe
        `);
        console.log('✔ Tabla "gestiones_relaciones":', verifyGestiones.rows[0].existe ? 'EXISTE ✅' : 'NO EXISTE ❌');

        // Mostrar columnas de relaciones
        if (verifyRelaciones.rows[0].existe) {
            const columns = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'relaciones'
                ORDER BY ordinal_position
            `);
            console.log('\n📋 Columnas de "relaciones":');
            columns.rows.forEach(col => {
                console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
            });
        }

        // Contar registros existentes
        if (verifyRelaciones.rows[0].existe) {
            const countRel = await pool.query('SELECT COUNT(*) as total FROM relaciones');
            console.log('\n📊 Registros en relaciones:', countRel.rows[0].total);
        }
        if (verifyGestiones.rows[0].existe) {
            const countGes = await pool.query('SELECT COUNT(*) as total FROM gestiones_relaciones');
            console.log('📊 Registros en gestiones_relaciones:', countGes.rows[0].total);
        }

        console.log('\n============================================');
        console.log(' Migración completada exitosamente! 🎉');
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
