/**
 * Migración: Agregar columnas de Completar Info a solicitudes + tabla solicitudes_referencias
 * 
 * Ejecutar con: node documentacion/migrar-produccion-completar-info.js
 *   (o si estás parado en /documentacion: node migrar-produccion-completar-info.js)
 * 
 * Lee DATABASE_URL del .env o .env.template y se conecta a PostgreSQL
 * para agregar las columnas y crear la tabla de referencias.
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Leer DATABASE_URL
let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    try {
        // Buscar .env o .env.template en múltiples ubicaciones
        var posiblesPaths = [
            path.join(process.cwd(), '.env.template'),           // directorio actual (template primero)
            path.join(process.cwd(), '.env'),                    // directorio actual
            path.join(__dirname, '..', '.env.template'),          // directorio padre del script (template primero)
            path.join(__dirname, '..', '.env'),                   // directorio padre del script
            path.join(__dirname, '.env.template'),                // mismo directorio del script
            path.join(__dirname, '.env')                          // mismo directorio del script
        ];
        
        var envPath = null;
        for (var i = 0; i < posiblesPaths.length; i++) {
            if (fs.existsSync(posiblesPaths[i])) {
                envPath = posiblesPaths[i];
                break;
            }
        }
        
        if (!envPath) {
            console.error('[ERROR] No se encontró .env ni .env.template');
            console.error('  Buscado en:', posiblesPaths.join('\n  '));
            process.exit(1);
        }
        
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/DATABASE_URL=(.+)/);
        if (match) {
            DATABASE_URL = match[1].trim();
            console.log('[INFO] DATABASE_URL leída desde', path.basename(envPath));
        }
    } catch (err) {
        console.error('[ERROR] No se pudo leer archivo de entorno:', err.message);
        process.exit(1);
    }
}

if (!DATABASE_URL) {
    console.error('[ERROR] No se encontró DATABASE_URL en .env, .env.template ni en variables de entorno');
    process.exit(1);
}

console.log('============================================');
console.log(' Migración: Completar Info en Solicitudes');
console.log(' - Agregar columnas a solicitudes');
console.log(' - Crear tabla solicitudes_referencias');
console.log('============================================\n');

async function main() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // --- PASO 1: Agregar columnas a solicitudes ---
        console.log('[1/2] Agregando columnas a tabla solicitudes...');

        await pool.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS correo_electronico TEXT;`);
        console.log('  ✅ correo_electronico (TEXT)');

        await pool.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS direccion TEXT;`);
        console.log('  ✅ direccion (TEXT)');

        await pool.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS direccion_trabajo TEXT;`);
        console.log('  ✅ direccion_trabajo (TEXT)');

        await pool.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS ocupacion TEXT;`);
        console.log('  ✅ ocupacion (TEXT)');

        await pool.query(`ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS ingreso_mensual DECIMAL(12,2);`);
        console.log('  ✅ ingreso_mensual (DECIMAL)');

        console.log('[OK] Columnas agregadas correctamente.\n');

        // --- PASO 2: Crear tabla solicitudes_referencias ---
        console.log('[2/2] Creando tabla solicitudes_referencias...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS solicitudes_referencias (
                id SERIAL PRIMARY KEY,
                id_solicitud INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                telefono TEXT,
                relacion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('  ✅ Tabla creada');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_solicitudes_referencias_solicitud
            ON solicitudes_referencias(id_solicitud);
        `);
        console.log('  ✅ Índice creado');

        console.log('[OK] Tabla solicitudes_referencias lista.\n');

        // --- VERIFICACIÓN ---
        console.log('============================================');
        console.log(' VERIFICACIÓN');
        console.log('============================================');

        const colResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'solicitudes' 
              AND column_name IN ('direccion', 'direccion_trabajo', 'ocupacion', 'ingreso_mensual')
            ORDER BY column_name;
        `);

        if (colResult.rows.length === 4) {
            console.log('✅ Las 4 columnas existen en solicitudes:');
            colResult.rows.forEach(row => {
                console.log(`   - ${row.column_name} (${row.data_type})`);
            });
        } else {
            console.warn('⚠️  Solo se encontraron', colResult.rows.length, 'de 4 columnas:');
            colResult.rows.forEach(row => {
                console.log(`   - ${row.column_name} (${row.data_type})`);
            });
        }

        const tabResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'solicitudes_referencias'
            ) as existe;
        `);

        if (tabResult.rows[0]?.existe) {
            console.log('✅ Tabla solicitudes_referencias existe');
        } else {
            console.warn('⚠️  Tabla solicitudes_referencias NO encontrada');
        }

        console.log('\n============================================');
        console.log(' Migración completada exitosamente!');
        console.log('============================================');
        console.log('\n📌 Ahora reinicia el servidor para que los cambios surtan efecto.');

    } catch (err) {
        console.error('[ERROR] Falló la migración:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
