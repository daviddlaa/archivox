// ============================================================================
// CONTROLADOR DE ESTADÍSTICAS POR USUARIO
// ============================================================================
// Arquitectura escalable de métricas. Cada métrica es una función independiente
// que se registra en el objeto METRICAS. Para agregar una nueva métrica:
//   1. Crear la función que ejecuta la consulta
//   2. Agregarla al objeto METRICAS con su metadata
// ============================================================================

const pool = require('../config/db.js');

// ============================================================================
// REGISTRO DE MÉTRICAS (extensible)
// ============================================================================
// Cada métrica tiene:
//   - key: identificador único
//   - label: nombre mostrado en la UI
//   - icon: emoji para la UI
//   - description: explicación breve
//   - query: función que ejecuta la consulta y devuelve { valor, porcentaje }
// ============================================================================

const METRICAS = {
    total_solicitudes: {
        label: 'Solicitudes creadas',
        icon: '📋',
        description: 'Cantidad total de registros importados por el usuario',
        query: async (usuarioId, totalSistema) => {
            const r = await pool.query(
                'SELECT COUNT(*) as total FROM solicitudes WHERE usuario_id = $1',
                [usuarioId]
            );
            const valor = parseInt(r.rows[0]?.total) || 0;
            return { valor, porcentaje: totalSistema > 0 ? ((valor / totalSistema) * 100).toFixed(1) : 0 };
        }
    },
    clientes_registrados: {
        label: 'Clientes registrados',
        icon: '👥',
        description: 'Clientes únicos (por cédula) registrados por el usuario',
        query: async (usuarioId, totalSistema) => {
            const r = await pool.query(
                'SELECT COUNT(DISTINCT cedula) as total FROM solicitudes WHERE usuario_id = $1 AND cedula IS NOT NULL AND cedula != \'\'',
                [usuarioId]
            );
            const valor = parseInt(r.rows[0]?.total) || 0;
            const t = await pool.query(
                'SELECT COUNT(DISTINCT cedula) as total FROM solicitudes WHERE cedula IS NOT NULL AND cedula != \'\''
            );
            const totalSis = parseInt(t.rows[0]?.total) || 1;
            return { valor, porcentaje: ((valor / totalSis) * 100).toFixed(1) };
        }
    },
    operaciones_realizadas: {
        label: 'Operaciones (gestiones)',
        icon: '⚡',
        description: 'Cantidad de gestiones realizadas por el usuario',
        query: async (usuarioId, totalSistema) => {
            const r = await pool.query(
                'SELECT COUNT(*) as total FROM gestiones WHERE usuario_id = $1',
                [usuarioId]
            );
            const valor = parseInt(r.rows[0]?.total) || 0;
            return { valor, porcentaje: totalSistema > 0 ? ((valor / totalSistema) * 100).toFixed(1) : 0 };
        }
    },
    relaciones_activas: {
        label: 'Relaciones activas',
        icon: '🔗',
        description: 'Relaciones en estado ALTA registradas por el usuario',
        query: async (usuarioId, totalSistema) => {
            const r = await pool.query(
                "SELECT COUNT(*) as total FROM relaciones WHERE usuario_id = $1 AND estado_relacion = 'ALTA'",
                [usuarioId]
            );
            const valor = parseInt(r.rows[0]?.total) || 0;
            const t = await pool.query(
                "SELECT COUNT(*) as total FROM relaciones WHERE estado_relacion = 'ALTA'"
            );
            const totalSis = parseInt(t.rows[0]?.total) || 1;
            return { valor, porcentaje: ((valor / totalSis) * 100).toFixed(1) };
        }
    },
    ventas_registradas: {
        label: 'Ventas registradas',
        icon: '💰',
        description: 'Total de vendedores registrados en control de ventas',
        query: async (usuarioId, totalSistema) => {
            const r = await pool.query(
                'SELECT COUNT(*) as total FROM ventas_vendedores WHERE usuario_id = $1',
                [usuarioId]
            );
            const valor = parseInt(r.rows[0]?.total) || 0;
            return { valor, porcentaje: totalSistema > 0 ? ((valor / totalSistema) * 100).toFixed(1) : 0 };
        }
    },
    modificaciones: {
        label: 'Modificaciones',
        icon: '✏️',
        description: 'Actualizaciones de datos realizadas por el usuario',
        query: async (usuarioId, totalSistema) => {
            const r = await pool.query(
                'SELECT COUNT(*) as total FROM historial_actualizaciones WHERE usuario_id = $1',
                [usuarioId]
            );
            const valor = parseInt(r.rows[0]?.total) || 0;
            return { valor, porcentaje: totalSistema > 0 ? ((valor / totalSistema) * 100).toFixed(1) : 0 };
        }
    },
    actividad_7_dias: {
        label: 'Actividad (7 días)',
        icon: '📈',
        description: 'Gestiones realizadas en los últimos 7 días',
        query: async (usuarioId) => {
            const r = await pool.query(
                "SELECT COUNT(*) as total FROM gestiones WHERE usuario_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'",
                [usuarioId]
            );
            const valor = parseInt(r.rows[0]?.total) || 0;
            return { valor, porcentaje: 0 };
        }
    },
    actividad_30_dias: {
        label: 'Actividad (30 días)',
        icon: '📊',
        description: 'Gestiones realizadas en el último mes',
        query: async (usuarioId) => {
            const r = await pool.query(
                "SELECT COUNT(*) as total FROM gestiones WHERE usuario_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'",
                [usuarioId]
            );
            const valor = parseInt(r.rows[0]?.total) || 0;
            return { valor, porcentaje: 0 };
        }
    }
};

// ============================================================================
// GET /api/admin/estadisticas/usuario/:id
// ============================================================================
exports.usuario = async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener info básica del usuario
        const userResult = await pool.query(
            `SELECT id, username, nombre, email, rol, is_superadmin, is_active,
                    created_at, last_login, updated_at
             FROM usuarios WHERE id = $1`,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuario = userResult.rows[0];

        // Obtener totales del sistema para calcular porcentajes
        const totales = await Promise.all([
            pool.query('SELECT COUNT(*) as total FROM solicitudes'),
            pool.query('SELECT COUNT(*) as total FROM gestiones'),
            pool.query("SELECT COUNT(*) as total FROM relaciones WHERE estado_relacion = 'ALTA'"),
            pool.query('SELECT COUNT(*) as total FROM historial_actualizaciones'),
            pool.query('SELECT COUNT(*) as total FROM ventas_vendedores')
        ]);

        const totalSistema = {
            solicitudes: parseInt(totales[0].rows[0]?.total) || 1,
            gestiones: parseInt(totales[1].rows[0]?.total) || 1,
            relaciones: parseInt(totales[2].rows[0]?.total) || 1,
            modificaciones: parseInt(totales[3].rows[0]?.total) || 1,
            ventas: parseInt(totales[4].rows[0]?.total) || 1
        };

        // Ejecutar todas las métricas en paralelo
        const resultados = {};
        const entradas = Object.entries(METRICAS);

        for (const [key, metrica] of entradas) {
            try {
                resultados[key] = await metrica.query(usuario.id, totalSistema.solicitudes);
                resultados[key].label = metrica.label;
                resultados[key].icon = metrica.icon;
                resultados[key].description = metrica.description;
            } catch (err) {
                console.error(`[Estadísticas] Error en métrica ${key}:`, err.message);
                resultados[key] = { valor: 0, porcentaje: 0, label: metrica.label, icon: metrica.icon, error: err.message };
            }
        }

        res.json({
            usuario: {
                id: usuario.id,
                username: usuario.username,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                is_superadmin: usuario.is_superadmin,
                is_active: usuario.is_active,
                created_at: usuario.created_at,
                last_login: usuario.last_login,
                updated_at: usuario.updated_at
            },
            metricas: resultados,
            total_sistema: totalSistema
        });
    } catch (err) {
        console.error('[Estadísticas] Error usuario:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// GET /api/admin/estadisticas/listado - Métricas de todos los usuarios (resumen)
// ============================================================================
exports.listado = async (req, res) => {
    try {
        // Obtener todos los usuarios con conteos básicos
        const result = await pool.query(`
            SELECT 
                u.id, u.username, u.nombre, u.email, u.rol, u.is_superadmin, u.is_active,
                u.created_at, u.last_login,
                (SELECT COUNT(*) FROM solicitudes s WHERE s.usuario_id = u.id) as total_solicitudes,
                (SELECT COUNT(*) FROM gestiones g WHERE g.usuario_id = u.id) as total_gestiones,
                (SELECT COUNT(*) FROM relaciones r WHERE r.usuario_id = u.id) as total_relaciones
            FROM usuarios u
            ORDER BY total_solicitudes DESC
        `);

        res.json({ data: result.rows });
    } catch (err) {
        console.error('[Estadísticas] Error listado:', err);
        res.status(500).json({ error: err.message });
    }
};
