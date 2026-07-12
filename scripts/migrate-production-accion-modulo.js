// ============================================================================
// MIGRACIÓN: Agregar columna accion_modulo a la tabla notificaciones
// ============================================================================
// ARCHIVOX - Deep Link Router (Opción B: Identificador Lógico)
//
// Propósito:
//   Agregar la columna accion_modulo a la tabla notificaciones en la base de
//   datos de producción (PostgreSQL en Render.com).
//
// Contexto:
//   - La nueva arquitectura de Deep Links reemplaza URLs fijas por módulos
//     lógicos (ej: 'solicitudes' en lugar de '/solicitudes' o '/m/solicitudes')
//   - Cada frontend (Desktop/Mobile) resuelve la URL según su plataforma
//   - Se requiere una columna accion_modulo TEXT para almacenar el módulo
//   - La columna accion_url existente se mantiene para compatibilidad hacia atrás
//
// Uso:
//   DATABASE_URL=postgresql://... node scripts/migrate-production-accion-modulo.js
//
// Compatibilidad:
//   ✅ PostgreSQL (producción en Render.com)
//   ✅ Compatible con SQLite (migración automática en initDb.js)
//   ✅ No rompe registros existentes
//   ✅ No requiere downtime
// ============================================================================

const { Client } = require('pg');

async function main() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ ERROR: DATABASE_URL no está definida.');
        console.error('');
        console.error('Uso:');
        console.error('  DATABASE_URL="postgresql://..." node scripts/migrate-production-accion-modulo.js');
        console.error('');
        process.exit(1);
    }

    console.log('='.repeat(70));
    console.log(' MIGRACIÓN: accion_modulo en notificaciones');
    console.log(' ARCHIVOX - Deep Link Router');
    console.log('='.repeat(70));
    console.log('');
    console.log(`🔌 Conectando a PostgreSQL...`);

    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }  // Render.com requiere SSL
    });

    try {
        await client.connect();
        console.log('✅ Conectado a la base de datos.');
        console.log('');

        // ====================================================================
        // PASO 1: Verificar estado actual de la tabla
        // ====================================================================
        console.log('📋 PASO 1: Verificando estructura actual de notificaciones...');

        const tableInfo = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'notificaciones'
            ORDER BY ordinal_position
        `);

        const columnasExistentes = tableInfo.rows.map(r => r.column_name);
        console.log(`   Columnas actuales (${columnasExistentes.length}): ${columnasExistentes.join(', ')}`);

        const tieneAccionModulo = columnasExistentes.includes('accion_modulo');

        // ====================================================================
        // PASO 2: Agregar columna si no existe
        // ====================================================================
        console.log('');
        console.log('📋 PASO 2: Agregando columna accion_modulo...');

        if (tieneAccionModulo) {
            console.log('   ⏩ La columna accion_modulo YA EXISTE. Omitiendo creación.');
        } else {
            await client.query(`
                ALTER TABLE notificaciones
                ADD COLUMN accion_modulo TEXT
            `);
            console.log('   ✅ Columna accion_modulo agregada correctamente.');
        }

        // ====================================================================
        // PASO 3: Migrar datos legacy (inferir accion_modulo desde accion_url)
        // ====================================================================
        console.log('');
        console.log('📋 PASO 3: Migrando datos legacy (accion_url → accion_modulo)...');

        // Contar registros legacy
        const legacyCount = await client.query(`
            SELECT COUNT(*) as total
            FROM notificaciones
            WHERE accion_url IS NOT NULL
              AND accion_url != ''
              AND (accion_modulo IS NULL OR accion_modulo = '')
        `);

        const totalLegacy = parseInt(legacyCount.rows[0]?.total) || 0;
        console.log(`   Registros legacy encontrados: ${totalLegacy}`);

        let registrosMigrados = 0;
        if (totalLegacy > 0) {
            const result = await client.query(`
                UPDATE notificaciones
                SET accion_modulo = CASE accion_url
                    WHEN '/' THEN 'dashboard'
                    WHEN '/m' THEN 'dashboard'
                    WHEN '/admin' THEN 'dashboard-admin'
                    WHEN '/m/admin' THEN 'dashboard-admin'
                    WHEN '/solicitudes' THEN 'solicitudes'
                    WHEN '/m/solicitudes' THEN 'solicitudes'
                    WHEN '/importar' THEN 'importar'
                    WHEN '/m/importar' THEN 'importar'
                    WHEN '/historial' THEN 'historial'
                    WHEN '/m/historial' THEN 'historial'
                    WHEN '/gestiones' THEN 'gestiones'
                    WHEN '/m/gestiones' THEN 'gestiones'
                    WHEN '/gestion-lote' THEN 'gestion-lote'
                    WHEN '/m/gestion-lote' THEN 'gestion-lote'
                    WHEN '/relaciones' THEN 'relaciones'
                    WHEN '/m/relaciones' THEN 'relaciones'
                    WHEN '/equipo-ventas' THEN 'ventas'
                    WHEN '/m/ventas' THEN 'ventas'
                    WHEN '/perfil' THEN 'perfil'
                    WHEN '/perfil?tab=config' THEN 'perfil-config'
                    WHEN '/perfil?tab=ayuda' THEN 'perfil-ayuda'
                    ELSE accion_modulo
                END
                WHERE accion_url IS NOT NULL
                  AND accion_url != ''
                  AND (accion_modulo IS NULL OR accion_modulo = '')
            `);

            registrosMigrados = result.rowCount;
            console.log(`   ✅ ${registrosMigrados} registros legacy migrados.`);
        } else {
            console.log('   ⏩ No hay registros legacy para migrar.');
        }

        // ====================================================================
        // PASO 4: Verificar resultados
        // ====================================================================
        console.log('');
        console.log('📋 PASO 4: Verificando resultados...');

        const stats = await client.query(`
            SELECT
                COUNT(*) as total_notificaciones,
                COUNT(accion_modulo) FILTER (WHERE accion_modulo IS NOT NULL AND accion_modulo != '') as con_modulo,
                COUNT(accion_url) FILTER (WHERE accion_url IS NOT NULL AND accion_url != '') as con_url,
                COUNT(*) FILTER (WHERE accion_modulo IS NULL AND (accion_url IS NULL OR accion_url = '')) as sin_accion
            FROM notificaciones
        `);

        const s = stats.rows[0];
        console.log(`   📊 Total notificaciones:  ${s.total_notificaciones}`);
        console.log(`   ✅ Con accion_modulo:     ${s.con_modulo}`);
        console.log(`   🔄 Con accion_url legacy: ${s.con_url}`);
        console.log(`   ℹ️  Sin acción:            ${s.sin_accion}`);

        // ====================================================================
        // PASO 5: Validar que la columna existe y tiene el tipo correcto
        // ====================================================================
        console.log('');
        console.log('📋 PASO 5: Validando tipo de columna...');

        const colInfo = await client.query(`
            SELECT data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'notificaciones'
              AND column_name = 'accion_modulo'
        `);

        if (colInfo.rows.length > 0) {
            console.log(`   ✅ accion_modulo: ${colInfo.rows[0].data_type} (nullable: ${colInfo.rows[0].is_nullable})`);
        } else {
            console.log('   ❌ ERROR: La columna accion_modulo no se encontró después de la migración.');
            process.exit(1);
        }

        // ====================================================================
        // RESUMEN
        // ====================================================================
        console.log('');
        console.log('='.repeat(70));
        console.log(' ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
        console.log('='.repeat(70));
        console.log('');
        console.log('Resumen de cambios:');
        console.log('  • Columna agregada:    notificaciones.accion_modulo (TEXT)');
        console.log('  • Registros migrados:  ' + registrosMigrados);
        console.log('  • Columna preservada:  notificaciones.accion_url (compatibilidad)');
        console.log('');
        console.log('La nueva arquitectura de Deep Links ya está operativa.');
        console.log('El frontend resuelve automáticamente la URL según la plataforma');
        console.log('del usuario usando DeepLinkRouter.');
        console.log('');

    } catch (err) {
        console.error('');
        console.error('❌ ERROR DURANTE LA MIGRACIÓN:');
        console.error('   ', err.message);
        console.error('');
        console.error('Stack trace:');
        console.error(err.stack);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Conexión cerrada.');
    }
}

main();
