// ============================================================================
// MIGRACIÓN 001: Panel de Administración - Fase 1
// ============================================================================
// Este script migra la base de datos PostgreSQL agregando las columnas de
// seguridad y administración a la tabla usuarios, crea la tabla audit_log,
// y asigna el usuario daviddlaa como primer superadmin del sistema.
//
// USO:
//   1. Asegúrate de tener DATABASE_URL en tu .env o como variable de entorno
//   2. Ejecuta: node migrations/001_add_admin_columns.js
// ============================================================================

require('dotenv').config();

const { Pool } = require('pg');

async function ejecutarMigracion() {
    console.log('='.repeat(60));
    console.log('  MIGRACIÓN 001: Panel de Administración');
    console.log('  Iniciando...');
    console.log('='.repeat(60));

    // Obtener DATABASE_URL: 1) argumento CLI, 2) variable entorno
    const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.error('');
        console.error('  ERROR: No se encontró DATABASE_URL');
        console.error('');
        console.error('  USO: node migrations/001_add_admin_columns.js "tu_url_de_postgresql"');
        console.error('  O bien: define DATABASE_URL en tu archivo .env');
        console.error('');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();

    try {
        console.log('\n📦 Conectado a PostgreSQL');

        // Iniciar transacción
        await client.query('BEGIN');
        console.log('   Transacción iniciada');

        // =====================================================================
        // PASO 1: Agregar nuevas columnas a usuarios
        // =====================================================================
        console.log('\n📌 PASO 1/6: Agregando columnas nuevas...');

        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT UNIQUE`);
        console.log('   ✅ email (TEXT UNIQUE)');

        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
        console.log('   ✅ email_verified (BOOLEAN DEFAULT FALSE)');

        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
        console.log('   ✅ is_active (BOOLEAN DEFAULT TRUE)');

        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE`);
        console.log('   ✅ is_superadmin (BOOLEAN DEFAULT FALSE)');

        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`);
        console.log('   ✅ failed_login_attempts (INTEGER DEFAULT 0)');

        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP`);
        console.log('   ✅ locked_until (TIMESTAMP)');

        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        console.log('   ✅ password_changed_at (TIMESTAMP DEFAULT NOW())');

        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        console.log('   ✅ updated_at (TIMESTAMP DEFAULT NOW())');

        // =====================================================================
        // PASO 2: Renombrar ultimo_login → last_login
        // =====================================================================
        console.log('\n📌 PASO 2/6: Renombrando ultimo_login → last_login...');

        const renameResult = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'usuarios' AND column_name = 'ultimo_login'
        `);

        if (renameResult.rows.length > 0) {
            await client.query(`ALTER TABLE usuarios RENAME COLUMN ultimo_login TO last_login`);
            console.log('   ✅ ultimo_login → last_login');
        } else {
            console.log('   ⏩ Ya existe last_login o no existía ultimo_login');
        }

        // =====================================================================
        // PASO 3: Asignar daviddlaa como superadmin
        // =====================================================================
        console.log('\n📌 PASO 3/6: Asignando daviddlaa como superadmin...');

        const resultDaviddlaa = await client.query(`
            UPDATE usuarios
            SET rol = 'admin',
                is_superadmin = TRUE,
                is_active = TRUE,
                updated_at = CURRENT_TIMESTAMP
            WHERE username = 'daviddlaa'
            RETURNING id, username, rol, is_superadmin
        `);

        if (resultDaviddlaa.rows.length > 0) {
            console.log(`   ✅ Usuario "${resultDaviddlaa.rows[0].username}" ahora es SUPERADMIN`);
        } else {
            console.log('   ⚠️  No se encontró el usuario "daviddlaa". Se creará cuando se registre.');
        }

        // =====================================================================
        // PASO 4: Asegurar que todos los demás sean usuarios normales
        // =====================================================================
        console.log('\n📌 PASO 4/6: Normalizando roles del resto de usuarios...');

        const resultUsers = await client.query(`
            UPDATE usuarios
            SET rol = 'user',
                is_superadmin = FALSE,
                is_active = TRUE,
                email_verified = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE username != 'daviddlaa'
              AND (rol IS NULL OR rol NOT IN ('admin', 'superadmin'))
            RETURNING id, username
        `);

        console.log(`   ✅ ${resultUsers.rowCount} usuario(s) actualizado(s) a rol 'user'`);

        // =====================================================================
        // PASO 5: Crear tabla audit_log
        // =====================================================================
        console.log('\n📌 PASO 5/6: Creando tabla audit_log...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id              SERIAL PRIMARY KEY,
                usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
                accion          TEXT NOT NULL,
                target_type     TEXT,
                target_id       INTEGER,
                detalle         JSONB,
                ip_address      TEXT,
                user_agent      TEXT,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ audit_log creada');

        // =====================================================================
        // Crear índices
        // =====================================================================
        console.log('\n📌 PASO 6/6: Creando índices...');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)`);
        console.log('   ✅ idx_usuarios_rol');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_is_active ON usuarios(is_active)`);
        console.log('   ✅ idx_usuarios_is_active');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usuarios_locked
            ON usuarios(locked_until) WHERE locked_until IS NOT NULL
        `);
        console.log('   ✅ idx_usuarios_locked');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id)`);
        console.log('   ✅ idx_audit_log_usuario');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion)`);
        console.log('   ✅ idx_audit_log_accion');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`);
        console.log('   ✅ idx_audit_log_created_at');

        // =====================================================================
        // Registrar migración en auditoría
        // =====================================================================
        if (resultDaviddlaa.rows.length > 0) {
            const adminId = resultDaviddlaa.rows[0].id;
            await client.query(`
                INSERT INTO audit_log (usuario_id, accion, target_type, detalle)
                VALUES ($1, 'system.migration', 'database', $2)
            `, [adminId, JSON.stringify({
                migration: '001_add_admin_columns',
                description: 'Panel de Administración - Fase 1',
                fecha: new Date().toISOString()
            })]);
            console.log('   ✅ Migración registrada en audit_log');
        }

        // =====================================================================
        // Confirmar transacción
        // =====================================================================
        await client.query('COMMIT');
        
        console.log('\n' + '='.repeat(60));
        console.log('  ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
        console.log('='.repeat(60));
        console.log('\nResumen:');
        console.log('  - 8 columnas nuevas agregadas a usuarios');
        console.log('  - ultimo_login renombrado a last_login');
        console.log('  - daviddlaa asignado como superadmin');
        console.log(`  - ${resultUsers.rowCount} usuario(s) normalizado(s) a rol user`);
        console.log('  - Tabla audit_log creada');
        console.log('  - 6 índices creados');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:');
        console.error(`   ${err.message}`);
        console.error('\n   Todos los cambios fueron revertidos (ROLLBACK).');
        console.error('   Revisa el error e intenta de nuevo.');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

ejecutarMigracion();
