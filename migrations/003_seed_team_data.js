// ============================================================================
// MIGRACIÓN 003b: Sistema Multi-Equipo — Seed Data
// ============================================================================
// Puebla las tablas del sistema multi-equipo con datos iniciales:
//   1. Crea el equipo "Sistema"
//   2. Asigna todos los usuarios actuales al equipo Sistema
//   3. Inserta permisos para roles lider, agente y user
//
// REQUIERE ejecutar ANTES:
//   node migrations/003_create_team_tables.js "postgresql://..."
//
// USO:
//   node migrations/003_seed_team_data.js "postgresql://..."
//   O: definir DATABASE_URL en .env y ejecutar sin argumentos
// ============================================================================

require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
    console.log('='.repeat(60));
    console.log('  MIGRACIÓN 003b: Sistema Multi-Equipo — Seed Data');
    console.log('='.repeat(60));

    const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.error('\n  ERROR: No se encontró DATABASE_URL');
        console.error('\n  USO: node migrations/003_seed_team_data.js "tu_url_de_postgresql"');
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
        // PASO 1: Crear equipo "Sistema"
        // =====================================================================
        console.log('📌 PASO 1/3: Creando equipo "Sistema"...');

        const equipoResult = await client.query(`
            INSERT INTO equipos (nombre, descripcion)
            SELECT 'Sistema', 'Equipo por defecto creado durante la migración. Todos los usuarios actuales pertenecen aquí inicialmente.'
            WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE nombre = 'Sistema')
            RETURNING id
        `);

        if (equipoResult.rows.length > 0) {
            console.log('   ✅ Equipo "Sistema" creado (id: ' + equipoResult.rows[0].id + ')');
        } else {
            console.log('   ⏩ El equipo "Sistema" ya existe');
        }

        // Obtener el ID del equipo Sistema (exista o recién creado)
        const sistema = await client.query(`SELECT id FROM equipos WHERE nombre = 'Sistema'`);
        const sistemaId = sistema.rows[0].id;

        // =====================================================================
        // PASO 2: Asignar usuarios al equipo Sistema
        // =====================================================================
        console.log('\n📌 PASO 2/3: Asignando usuarios al equipo "Sistema"...');

        // 2a. SUPERADMIN como líder
        const liderResult = await client.query(`
            INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
            SELECT $1, u.id, 1
            FROM usuarios u
            WHERE u.is_superadmin = TRUE
              AND NOT EXISTS (
                SELECT 1 FROM equipo_usuarios eu
                WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
              )
            RETURNING id
        `, [sistemaId]);
        console.log(`   ✅ ${liderResult.rowCount} superadmin(s) asignado(s) como líder(es)`);

        // 2b. ADMIN como miembros
        const adminResult = await client.query(`
            INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
            SELECT $1, u.id, 0
            FROM usuarios u
            WHERE u.rol = 'admin'
              AND (u.is_superadmin IS NULL OR u.is_superadmin = FALSE)
              AND NOT EXISTS (
                SELECT 1 FROM equipo_usuarios eu
                WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
              )
            RETURNING id
        `, [sistemaId]);
        console.log(`   ✅ ${adminResult.rowCount} admin(s) asignado(s) como miembro(s)`);

        // 2c. Demás usuarios como miembros
        const usersResult = await client.query(`
            INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
            SELECT $1, u.id, 0
            FROM usuarios u
            WHERE (u.rol IS NULL OR u.rol NOT IN ('admin', 'superadmin'))
              AND u.id NOT IN (
                SELECT eu.usuario_id FROM equipo_usuarios eu WHERE eu.fecha_salida IS NULL
              )
            RETURNING id
        `, [sistemaId]);
        console.log(`   ✅ ${usersResult.rowCount} usuario(s) asignado(s) como miembro(s)`);

        // =====================================================================
        // PASO 3: Insertar permisos de roles
        // =====================================================================
        console.log('\n📌 PASO 3/3: Insertando permisos de roles...');

        const liderPermisos = [
            'equipo:ver', 'equipo:gestionar',
            'agentes:ver', 'agentes:crear', 'agentes:editar', 'agentes:desactivar',
            'campañas:ver', 'campañas:crear', 'campañas:gestionar', 'campañas:asignar',
            'solicitudes:importar', 'solicitudes:ver-equipo',
            'solicitudes:asignar', 'solicitudes:reasignar', 'solicitudes:ver-asignaciones',
            'gestiones:ver-equipo',
            'dashboard:ver-equipo', 'dashboard:ver-agentes',
            'relaciones:ver-equipo',
            'historial:ver-equipo'
        ];

        const agentePermisos = [
            'campañas:ver-propias',
            'solicitudes:ver-asignadas', 'solicitudes:gestionar',
            'solicitudes:editar-estado', 'solicitudes:completar-info',
            'gestiones:crear', 'gestiones:ver-propias', 'gestiones:editar',
            'relaciones:gestionar',
            'historial:ver-propio',
            'perfil:ver', 'perfil:editar'
        ];

        const userPermisos = [
            'solicitudes:importar', 'solicitudes:ver-propias', 'solicitudes:gestionar',
            'solicitudes:editar-estado', 'solicitudes:completar-info',
            'campañas:crear', 'campañas:gestionar',
            'gestiones:crear', 'gestiones:ver-propias', 'gestiones:editar',
            'relaciones:gestionar', 'ventas:gestionar',
            'historial:ver-propio',
            'perfil:ver', 'perfil:editar'
        ];

        // Función helper para insertar permisos
        async function insertarPermisos(rol, permisos) {
            let count = 0;
            for (const p of permisos) {
                try {
                    await client.query(
                        `INSERT INTO permisos_roles (rol, permiso) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                        [rol, p]
                    );
                    count++;
                } catch (e) {
                    // Ya existe, ignorar
                }
            }
            return count;
        }

        const liderCount = await insertarPermisos('lider', liderPermisos);
        console.log(`   ✅ ${liderCount} permisos de lider insertados`);

        const agenteCount = await insertarPermisos('agente', agentePermisos);
        console.log(`   ✅ ${agenteCount} permisos de agente insertados`);

        const userCount = await insertarPermisos('user', userPermisos);
        console.log(`   ✅ ${userCount} permisos de user insertados`);

        // =====================================================================
        // VERIFICACIÓN
        // =====================================================================
        console.log('\n📌 Verificando datos insertados...');

        const counts = await Promise.all([
            client.query('SELECT COUNT(*) as total FROM equipos'),
            client.query('SELECT COUNT(*) as total FROM equipo_usuarios'),
            client.query('SELECT COUNT(*) as total FROM permisos_roles'),
        ]);

        console.log(`   · equipos:           ${counts[0].rows[0].total}`);
        console.log(`   · equipo_usuarios:    ${counts[1].rows[0].total}`);
        console.log(`   · permisos_roles:     ${counts[2].rows[0].total}`);

        const usuariosSinEquipo = await client.query(`
            SELECT COUNT(*) as total FROM usuarios u
            WHERE NOT EXISTS (
                SELECT 1 FROM equipo_usuarios eu
                WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
            )
        `);
        console.log(`   · usuarios sin equipo: ${usuariosSinEquipo.rows[0].total}`);

        if (parseInt(usuariosSinEquipo.rows[0].total) > 0) {
            console.log('   ⚠️  Hay usuarios sin equipo. Verificar la migración manualmente.');
        } else {
            console.log('   ✅ Todos los usuarios tienen equipo asignado');
        }

        // =====================================================================
        // CONFIRMAR TRANSACCIÓN
        // =====================================================================
        await client.query('COMMIT');

        console.log('\n' + '='.repeat(60));
        console.log('  ✅ MIGRACIÓN 003b COMPLETADA EXITOSAMENTE');
        console.log('='.repeat(60));
        console.log('\nResumen:');
        console.log('  - 1 equipo creado: "Sistema"');
        console.log(`  - ${liderResult.rowCount + adminResult.rowCount + usersResult.rowCount} usuarios asignados`);
        console.log('  - ' + (liderCount + agenteCount + userCount) + ' permisos insertados');
        console.log('  - 0 usuarios huérfanos');
        console.log('\n📌 El sistema multi-equipo está listo para la FASE 5 (Backend).');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:');
        console.error('   ' + err.message);
        console.error('\n   Todos los cambios fueron revertidos (ROLLBACK).');
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
