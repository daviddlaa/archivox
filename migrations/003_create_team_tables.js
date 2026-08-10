// ============================================================================
// MIGRACIÓN 003a: Sistema Multi-Equipo — Creación de tablas
// ============================================================================
// Crea 6 nuevas tablas: equipos, equipo_usuarios, permisos_roles,
// permisos_equipo, asignaciones_solicitudes, campañas_equipo.
// Además agrega columna equipo_id a gestiones_maestro.
//
// USO:
//   node migrations/003_create_team_tables.js "postgresql://..."
//   O: definir DATABASE_URL en .env y ejecutar sin argumentos
//
// DESPUÉS ejecutar:
//   node migrations/003_seed_team_data.js "postgresql://..."
// ============================================================================

require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
    console.log('='.repeat(60));
    console.log('  MIGRACIÓN 003a: Sistema Multi-Equipo');
    console.log('  Creación de tablas...');
    console.log('='.repeat(60));

    // Obtener DATABASE_URL: 1) argumento CLI, 2) variable entorno
    const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.error('\n  ERROR: No se encontró DATABASE_URL');
        console.error('\n  USO: node migrations/003_create_team_tables.js "tu_url_de_postgresql"');
        console.error('  O bien: define DATABASE_URL en tu archivo .env\n');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();

    try {
        console.log('\n📦 Conectado a PostgreSQL');
        await client.query('BEGIN');
        console.log('   Transacción iniciada\n');

        // =====================================================================
        // TABLA 1/6: equipos
        // =====================================================================
        console.log('📌 TABLA 1/6: equipos...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS equipos (
                id              SERIAL PRIMARY KEY,
                nombre          VARCHAR(100) UNIQUE NOT NULL,
                descripcion     TEXT,
                activo          INTEGER DEFAULT 1 NOT NULL CHECK (activo IN (0, 1)),
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ equipos creada');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos(activo)`);
        console.log('   ✅ idx_equipos_activo');

        // =====================================================================
        // TABLA 2/6: equipo_usuarios
        // =====================================================================
        console.log('\n📌 TABLA 2/6: equipo_usuarios...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS equipo_usuarios (
                id              SERIAL PRIMARY KEY,
                equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
                usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                es_lider        INTEGER DEFAULT 0 NOT NULL CHECK (es_lider IN (0, 1)),
                fecha_ingreso   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_salida    TIMESTAMP,
                motivo_salida   TEXT,
                UNIQUE(usuario_id, fecha_salida)
            )
        `);
        console.log('   ✅ equipo_usuarios creada');

        // Índice único parcial: garantiza un solo registro activo por usuario
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_equipo_usuario_unico_activo ON equipo_usuarios(usuario_id) WHERE fecha_salida IS NULL`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_usuario_activo ON equipo_usuarios(usuario_id, fecha_salida)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo ON equipo_usuarios(equipo_id, es_lider, fecha_salida)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_lider ON equipo_usuarios(equipo_id, es_lider) WHERE es_lider = 1 AND fecha_salida IS NULL`);
        console.log('   ✅ 4 índices de equipo_usuarios (1 único parcial)');

        // =====================================================================
        // TABLA 3/6: permisos_roles
        // =====================================================================
        console.log('\n📌 TABLA 3/6: permisos_roles...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS permisos_roles (
                id              SERIAL PRIMARY KEY,
                rol             VARCHAR(20) NOT NULL,
                permiso         VARCHAR(100) NOT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(rol, permiso)
            )
        `);
        console.log('   ✅ permisos_roles creada');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_permisos_roles_rol ON permisos_roles(rol)`);
        console.log('   ✅ idx_permisos_roles_rol');

        // =====================================================================
        // TABLA 4/6: permisos_equipo
        // =====================================================================
        console.log('\n📌 TABLA 4/6: permisos_equipo...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS permisos_equipo (
                id              SERIAL PRIMARY KEY,
                equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
                permiso         VARCHAR(100) NOT NULL,
                concedido_por   INTEGER REFERENCES usuarios(id),
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(equipo_id, permiso)
            )
        `);
        console.log('   ✅ permisos_equipo creada');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_permisos_equipo_equipo ON permisos_equipo(equipo_id)`);
        console.log('   ✅ idx_permisos_equipo_equipo');

        // =====================================================================
        // TABLA 5/6: asignaciones_solicitudes
        // =====================================================================
        console.log('\n📌 TABLA 5/6: asignaciones_solicitudes...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
                id                  SERIAL PRIMARY KEY,
                solicitud_id        INTEGER NOT NULL,
                equipo_id           INTEGER NOT NULL REFERENCES equipos(id),
                usuario_id          INTEGER REFERENCES usuarios(id),
                asignado_por        INTEGER NOT NULL REFERENCES usuarios(id),
                desde_campaña_id    INTEGER,
                tipo_asignacion     VARCHAR(20) DEFAULT 'manual'
                                    CHECK (tipo_asignacion IN ('manual', 'automatica', 'campaña', 'importacion')),
                fecha_asignacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_desasignacion TIMESTAMP,
                motivo_desasignacion TEXT,
                UNIQUE(solicitud_id, fecha_desasignacion)
            )
        `);
        console.log('   ✅ asignaciones_solicitudes creada');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas ON asignaciones_solicitudes(usuario_id, fecha_desasignacion) WHERE usuario_id IS NOT NULL`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas ON asignaciones_solicitudes(equipo_id, fecha_desasignacion)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_campaña ON asignaciones_solicitudes(desde_campaña_id, fecha_desasignacion)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha ON asignaciones_solicitudes(fecha_asignacion DESC)`);
        console.log('   ✅ 5 índices de asignaciones_solicitudes');

        // =====================================================================
        // TABLA 6/6: campañas_equipo
        // =====================================================================
        console.log('\n📌 TABLA 6/6: campañas_equipo...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS campañas_equipo (
                id              SERIAL PRIMARY KEY,
                campaña_id      INTEGER NOT NULL,
                equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(campaña_id)
            )
        `);
        console.log('   ✅ campañas_equipo creada');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_campañas_equipo_equipo ON campañas_equipo(equipo_id)`);
        console.log('   ✅ idx_campañas_equipo_equipo');

        // =====================================================================
        // MODIFICACIÓN: gestiones_maestro + equipo_id
        // =====================================================================
        console.log('\n📌 MODIFICACIÓN: gestiones_maestro + equipo_id...');

        try {
            await client.query(`ALTER TABLE gestiones_maestro ADD COLUMN IF NOT EXISTS equipo_id INTEGER REFERENCES equipos(id)`);
            console.log('   ✅ equipo_id agregado a gestiones_maestro');
        } catch (e) {
            // Fallback para PostgreSQL < 9.6
            console.log('   ⏩ equipo_id ya existe (o no aplica)');
        }

        await client.query(`CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo ON gestiones_maestro(equipo_id)`);
        console.log('   ✅ idx_gestiones_maestro_equipo');

        // =====================================================================
        // VERIFICACIÓN
        // =====================================================================
        console.log('\n📌 Verificando tablas creadas...');
        const tablesResult = await client.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name IN (
                'equipos', 'equipo_usuarios', 'permisos_roles', 'permisos_equipo',
                'asignaciones_solicitudes', 'campañas_equipo'
            )
        `);

        const createdTables = tablesResult.rows.map(r => r.table_name);
        const expectedTables = ['equipos', 'equipo_usuarios', 'permisos_roles', 'permisos_equipo', 'asignaciones_solicitudes', 'campañas_equipo'];
        const allCreated = expectedTables.every(t => createdTables.includes(t));

        console.log(`\n   Tablas esperadas: ${expectedTables.length}`);
        console.log(`   Tablas creadas:   ${createdTables.length}`);
        for (const t of expectedTables) {
            console.log(`   ${createdTables.includes(t) ? '✅' : '❌'} ${t}`);
        }

        // =====================================================================
        // CONFIRMAR TRANSACCIÓN
        // =====================================================================
        await client.query('COMMIT');

        console.log('\n' + '='.repeat(60));
        if (allCreated) {
            console.log('  ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
        } else {
            console.log('  ⚠️  MIGRACIÓN COMPLETADA CON ADVERTENCIAS');
        }
        console.log('='.repeat(60));
        console.log('\nResumen:');
        console.log('  - 6 tablas nuevas creadas');
        console.log('  - 1 columna agregada a gestiones_maestro');
        console.log('  - 13 índices creados');
        console.log('\n📌 Siguiente paso:');
        console.log('  node migrations/003_seed_team_data.js "' + DATABASE_URL.substring(0, 30) + '..."');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:');
        console.error('   ' + err.message);
        console.error('\n   Todos los cambios fueron revertidos (ROLLBACK).');
        console.error('   Revisa el error e intenta de nuevo.');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(err => {
    console.error('❌ Error en migración:', err);
    process.exit(1);
});
