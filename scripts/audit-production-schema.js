// ============================================================================
// AUDITORÍA DE ESQUEMA PostgreSQL (Producción en Render)
// ============================================================================
// Este script se conecta a la base de datos de producción y extrae:
//   - Todas las tablas con sus columnas, tipos, defaults, constraints
//   - Índices
//   - Secuencias
//   - Triggers
// Luego compara con el esquema esperado definido en initDb.pg.js
// ============================================================================

const { Pool } = require('pg');

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
    console.error('USO: node scripts/audit-production-schema.js "postgresql://..."');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function auditSchema() {
    const client = await pool.connect();
    try {
        console.log('='.repeat(80));
        console.log('  AUDITORÍA COMPLETA DE ESQUEMA POSTGRESQL');
        console.log('  Base de datos:', DATABASE_URL.split('@')[1]?.split('/')[0] || 'N/A');
        console.log('='.repeat(80));

        // ====================================================================
        // 1. TABLAS
        // ====================================================================
        console.log('\n📋 TABLAS ENCONTRADAS:');
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        for (const table of tables.rows) {
            console.log(`\n📌 TABLA: ${table.table_name}`);
            console.log('-'.repeat(60));

            // Columnas
            const columns = await client.query(`
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    column_default,
                    is_nullable,
                    identity_generation
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position
            `, [table.table_name]);

            console.log('   Columnas:');
            for (const col of columns.rows) {
                const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
                console.log(`     - ${col.column_name.padEnd(25)} ${col.data_type}${length} ${nullable}${defaultVal}`);
            }

            // Check constraints (PK, FK, UNIQUE, CHECK) using pg_catalog
            const constraints = await client.query(`
                SELECT
                    con.conname AS constraint_name,
                    con.contype AS constraint_type,
                    pg_get_constraintdef(con.oid) AS constraint_def
                FROM pg_catalog.pg_constraint con
                JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
                JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
                WHERE rel.relname = $1
                  AND nsp.nspname = 'public'
                ORDER BY con.contype
            `, [table.table_name]);

            if (constraints.rows.length > 0) {
                console.log('   Restricciones:');
                for (const con of constraints.rows) {
                    const typeLabels = {'p': 'PRIMARY KEY', 'f': 'FOREIGN KEY', 'u': 'UNIQUE', 'c': 'CHECK'};
                    const label = typeLabels[con.constraint_type] || con.constraint_type;
                    console.log(`     - ${label.padEnd(12)} ${con.constraint_def}`);
                }
            }
        }

        // ====================================================================
        // 2. ÍNDICES
        // ====================================================================
        console.log('\n\n📋 ÍNDICES:');
        const indices = await client.query(`
            SELECT
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname
        `);
        
        for (const idx of indices.rows) {
            console.log(`   📌 ${idx.tablename}.${idx.indexname}`);
            console.log(`      ${idx.indexdef}`);
        }

        // ====================================================================
        // 3. SECUENCIAS
        // ====================================================================
        console.log('\n\n📋 SECUENCIAS:');
        const sequences = await client.query(`
            SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
            FROM information_schema.sequences
            WHERE sequence_schema = 'public'
            ORDER BY sequence_name
        `);
        
        for (const seq of sequences.rows) {
            console.log(`   - ${seq.sequence_name} (${seq.data_type}, start: ${seq.start_value}, inc: ${seq.increment})`);
        }

        // ====================================================================
        // 4. TRIGGERS
        // ====================================================================
        console.log('\n\n📋 TRIGGERS:');
        const triggers = await client.query(`
            SELECT trigger_name, event_manipulation, event_object_table, action_timing
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            ORDER BY trigger_name
        `);
        
        if (triggers.rows.length === 0) {
            console.log('   (No hay triggers definidos)');
        } else {
            for (const trg of triggers.rows) {
                console.log(`   - ${trg.trigger_name} (${trg.action_timing} ${trg.event_manipulation} ON ${trg.event_object_table})`);
            }
        }

        // ====================================================================
        // 5. ANÁLISIS DETALLADO: TABLA notificaciones
        // ====================================================================
        console.log('\n\n🔍 ANÁLISIS DETALLADO: notificaciones');
        console.log('='.repeat(80));
        
        const notifCols = await client.query(`
            SELECT 
                column_name,
                data_type,
                column_default,
                is_nullable,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'notificaciones'
            ORDER BY ordinal_position
        `);

        console.log('\n   Esquema actual en producción:');
        const actualCols = {};
        for (const col of notifCols.rows) {
            actualCols[col.column_name] = col;
            console.log(`     - ${col.column_name.padEnd(20)} ${col.data_type}${col.column_default ? ' DEFAULT ' + col.column_default : ''}`);
        }

        // Esquema esperado según initDb.pg.js
        console.log('\n   Esquema esperado:');
        const expectedSchema = {
            'id': 'integer',
            'titulo': 'text',
            'mensaje': 'text',
            'tipo': 'text',
            'prioridad': 'text',
            'creador_id': 'integer',
            'destinatario_id': 'integer',
            'leida': 'integer',
            'leida_at': 'timestamp without time zone',
            'archivada': 'integer',
            'accion_url': 'text',
            'accion_texto': 'text',
            'fecha_expiracion': 'timestamp without time zone',
            'created_at': 'timestamp without time zone'
        };

        for (const [colName, expectedType] of Object.entries(expectedSchema)) {
            const actual = actualCols[colName];
            if (!actual) {
                console.log(`   ❌ FALTA: ${colName} (${expectedType}) - ¡NO EXISTE EN PRODUCCIÓN!`);
            } else if (actual.data_type !== expectedType) {
                console.log(`   ⚠️  DIFERENTE: ${colName} - actual: ${actual.data_type}, esperado: ${expectedType}`);
            } else {
                console.log(`   ✅ OK: ${colName}`);
            }
        }

        // Verificar columnas extra no esperadas
        for (const [colName] of Object.entries(actualCols)) {
            if (!expectedSchema[colName]) {
                console.log(`   ℹ️  EXTRA: ${colName} - existe en producción pero no en el esquema esperado`);
            }
        }

        // ====================================================================
        // 6. Verificar CHECK constraints de notificaciones
        // ====================================================================
        console.log('\n\n🔍 CHECK CONSTRAINTS de notificaciones:');
        const checkConstraints = await client.query(`
            SELECT 
                conname AS constraint_name,
                pg_get_constraintdef(oid) AS constraint_def
            FROM pg_constraint
            WHERE conrelid = 'notificaciones'::regclass
              AND contype = 'c'
        `);
        
        if (checkConstraints.rows.length === 0) {
            console.log('   ⚠️  No hay CHECK constraints en notificaciones');
        } else {
            for (const ck of checkConstraints.rows) {
                console.log(`   - ${ck.constraint_name}: ${ck.constraint_def}`);
            }
        }

        // ====================================================================
        // 7. VERIFICAR que leida es INTEGER (no BOOLEAN)
        // ====================================================================
        console.log('\n\n🔍 VERIFICACIÓN ESPECIAL: columna "leida"');
        const leidaCheck = await client.query(`
            SELECT data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'notificaciones' AND column_name = 'leida'
        `);
        
        if (leidaCheck.rows.length > 0) {
            const leida = leidaCheck.rows[0];
            console.log(`   Tipo actual: ${leida.data_type}`);
            console.log(`   Default actual: ${leida.column_default}`);
            
            if (leida.data_type === 'boolean') {
                console.log('   ❌ ¡PROBLEMA! leida es BOOLEAN - las consultas WHERE leida = 0 van a fallar con error 500!');
                console.log('   Se necesita migrar a INTEGER');
            } else if (leida.data_type === 'integer') {
                console.log('   ✅ leida es INTEGER - correcto');
            }
        } else {
            console.log('   ❌ No se encontró la columna leida');
        }

        // Verificar archivada también
        console.log('\n🔍 VERIFICACIÓN ESPECIAL: columna "archivada"');
        const archivadaCheck = await client.query(`
            SELECT data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'notificaciones' AND column_name = 'archivada'
        `);
        
        if (archivadaCheck.rows.length > 0) {
            const arch = archivadaCheck.rows[0];
            console.log(`   Tipo actual: ${arch.data_type}`);
            if (arch.data_type === 'boolean') {
                console.log('   ❌ ¡PROBLEMA! archivada es BOOLEAN');
            } else if (arch.data_type === 'integer') {
                console.log('   ✅ archivada es INTEGER - correcto');
            }
        } else {
            console.log('   ℹ️ No se encontró la columna archivada (puede que falte)');
        }

        console.log('\n' + '='.repeat(80));
        console.log('  AUDITORÍA COMPLETADA');
        console.log('='.repeat(80));

    } catch (err) {
        console.error('ERROR durante la auditoría:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

auditSchema();
