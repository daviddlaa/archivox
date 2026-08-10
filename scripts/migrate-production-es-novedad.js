// ============================================================================
// MIGRACIÓN: Agregar columna es_novedad a la tabla notificaciones
// ============================================================================
// ARCHIVOX - Centro de Novedades (anuncios de nuevas funcionalidades)
//
// Propósito:
//   Agregar la columna es_novedad (INTEGER, default 0) a la tabla notificaciones
//   en la base de datos de producción (PostgreSQL en Render.com).
//
// Contexto:
//   - Las "Novedades" son notificaciones globales destacadas que anuncian
//     nuevas funcionalidades de Archivox a todos los usuarios.
//   - Se muestran en una sección especial "🆕 Novedades" en el centro de
//     notificaciones, con deep links a las pantallas correspondientes.
//   - es_novedad = 1 → el anuncio se muestra destacado en la sección Novedades
//
// Uso:
//   DATABASE_URL=postgresql://... node scripts/migrate-production-es-novedad.js
//
// Compatibilidad:
//   ✅ PostgreSQL (producción en Render.com)
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
        console.error('  DATABASE_URL="postgresql://..." node scripts/migrate-production-es-novedad.js');
        console.error('');
        process.exit(1);
    }

    console.log('='.repeat(70));
    console.log(' MIGRACIÓN: es_novedad en notificaciones');
    console.log(' ARCHIVOX - Centro de Novedades');
    console.log('='.repeat(70));
    console.log('');
    console.log('🔌 Conectando a PostgreSQL...');

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

        const tieneEsNovedad = columnasExistentes.includes('es_novedad');

        // ====================================================================
        // PASO 2: Agregar columna si no existe
        // ====================================================================
        console.log('');
        console.log('📋 PASO 2: Agregando columna es_novedad...');

        if (tieneEsNovedad) {
            console.log('   ⏩ La columna es_novedad YA EXISTE. Omitiendo creación.');
        } else {
            await client.query(`
                ALTER TABLE notificaciones
                ADD COLUMN es_novedad INTEGER DEFAULT 0
            `);
            console.log('   ✅ Columna es_novedad agregada correctamente.');
        }

        // ====================================================================
        // PASO 3: Verificar resultados
        // ====================================================================
        console.log('');
        console.log('📋 PASO 3: Verificando resultados...');

        const stats = await client.query(`
            SELECT
                COUNT(*) as total_notificaciones,
                COUNT(*) FILTER (WHERE es_novedad = 1) as novedades,
                COUNT(*) FILTER (WHERE es_novedad IS NULL) as sin_valor
            FROM notificaciones
        `);

        const s = stats.rows[0];
        console.log(`   📊 Total notificaciones:  ${s.total_notificaciones}`);
        console.log(`   ✨ Novedades (es_novedad=1): ${s.novedades}`);
        console.log(`   ℹ️  Sin valor (NULL):      ${s.sin_valor}`);

        // ====================================================================
        // PASO 4: Validar tipo de columna
        // ====================================================================
        console.log('');
        console.log('📋 PASO 4: Validando tipo de columna...');

        const colInfo = await client.query(`
            SELECT data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'notificaciones'
              AND column_name = 'es_novedad'
        `);

        if (colInfo.rows.length > 0) {
            console.log(`   ✅ es_novedad: ${colInfo.rows[0].data_type} (nullable: ${colInfo.rows[0].is_nullable}, default: ${colInfo.rows[0].column_default})`);
        } else {
            console.log('   ❌ ERROR: La columna es_novedad no se encontró después de la migración.');
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
        console.log('  • Columna agregada:    notificaciones.es_novedad (INTEGER, default 0)');
        console.log('');
        console.log('El Centro de Novedades ya está listo para usarse.');
        console.log('Crea anuncios con es_novedad=1 desde el panel admin para que');
        console.log('aparezcan en la sección "🆕 Novedades" de todos los usuarios.');
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
