// ============================================================================
// CONTROLADOR DE DASHBOARD — Separado de excel.controller.js (SRP)
// ============================================================================
// Contiene todas las funciones de dashboard, estadísticas y KPIs.
// Extraído del monolito excel.controller.js para aplicar Single Responsibility.
// ============================================================================

const pool = require('../config/db.js');
const cache = require('../config/cache.js');

// ============================================================================
// DASHBOARD PRINCIPAL (totales por estado)
// ============================================================================
// GET /api/excel/dashboard
// Cacheado en servidor (30s) para reducir carga en PostgreSQL
// ============================================================================
exports.dashboard = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    // Intentar servir desde caché
    const cached = cache.getDashboard(usuarioId);
    if (cached) {
        return res.json(cached);
    }

    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN estado = 'ACTIVADA' THEN 1 ELSE 0 END) as activadas,
                SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) as rechazadas,
                SUM(CASE WHEN estado = 'DEVUELTA' THEN 1 ELSE 0 END) as devueltas,
                SUM(CASE WHEN estado = 'APROBADA PARA LIBERACIÓN' THEN 1 ELSE 0 END) as pendientes
            FROM solicitudes
            WHERE usuario_id = $1
        `, [usuarioId]);

        const data = result.rows[0] || {};
        const response = {
            total: Number(data.total) || 0,
            activadas: Number(data.activadas) || 0,
            rechazadas: Number(data.rechazadas) || 0,
            devueltas: Number(data.devueltas) || 0,
            pendientes: Number(data.pendientes) || 0,
        };

        // Guardar en caché
        cache.setDashboard(usuarioId, response);
        res.json(response);
    } catch (err) {
        console.error('[Dashboard] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// DASHBOARD SEGMENTOS
// ============================================================================
// GET /api/excel/dashboard/segmentos
// ============================================================================
exports.dashboardSegmentos = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const cached = cache.getDashboardSegmentos(usuarioId);
    if (cached) {
        return res.json(cached);
    }

    try {
        const result = await pool.query(`
            SELECT segmento, COUNT(*) as total
            FROM solicitudes
            WHERE usuario_id = $1 AND segmento IS NOT NULL AND segmento != ''
            GROUP BY segmento
            ORDER BY total DESC
        `, [usuarioId]);

        cache.setDashboardSegmentos(usuarioId, result.rows);
        res.json(result.rows);
    } catch (err) {
        console.error('[Dashboard] Error segmentos:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// DASHBOARD ESTADOS
// ============================================================================
// GET /api/excel/dashboard/estados
// ============================================================================
exports.dashboardEstados = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    const cached = cache.getDashboardEstados(usuarioId);
    if (cached) {
        return res.json(cached);
    }

    try {
        const result = await pool.query(`
            SELECT estado, COUNT(*) as total
            FROM solicitudes
            WHERE usuario_id = $1 AND estado IS NOT NULL AND estado != ''
            GROUP BY estado
            ORDER BY total DESC
        `, [usuarioId]);

        cache.setDashboardEstados(usuarioId, result.rows);
        res.json(result.rows);
    } catch (err) {
        console.error('[Dashboard] Error estados:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// SEGMENTOS FILTRADOS POR ESTADO
// ============================================================================
// GET /api/excel/dashboard/segmentos/filtrado?estado=
// ============================================================================
exports.dashboardSegmentosFiltrado = async (req, res) => {
    const { estado } = req.query;
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        let sql = `
            SELECT segmento, COUNT(*) as total
            FROM solicitudes
            WHERE usuario_id = $1
        `;
        const params = [usuarioId];
        if (estado) {
            sql += ' AND estado = $' + (params.length + 1);
            params.push(estado);
        }
        sql += ' AND segmento IS NOT NULL AND segmento != \'\' GROUP BY segmento ORDER BY total DESC';

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[Dashboard] Error segmentos filtrado:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// ESTADOS FILTRADOS POR SEGMENTO
// ============================================================================
// GET /api/excel/dashboard/estados/filtrado?segmento=
// ============================================================================
exports.dashboardEstadosFiltrado = async (req, res) => {
    const { segmento } = req.query;
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        let sql = `
            SELECT estado, COUNT(*) as total
            FROM solicitudes
            WHERE usuario_id = $1
        `;
        const params = [usuarioId];
        if (segmento) {
            sql += ' AND segmento = $' + (params.length + 1);
            params.push(segmento);
        }
        sql += ' AND estado IS NOT NULL AND estado != \'\' GROUP BY estado ORDER BY total DESC';

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[Dashboard] Error estados filtrado:', err);
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// PROMEDIO MENSUAL (últimos 3 meses)
// ============================================================================
// GET /api/excel/dashboard/promedio/mes
// ============================================================================
exports.dashboardPromedioMes = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        const result = await pool.query(
            `SELECT COUNT(*) as total 
             FROM solicitudes 
             WHERE usuario_id = $1 
               AND fecha_solicitud >= CURRENT_DATE - INTERVAL '90 days'`,
            [usuarioId]
        );
        const total = parseInt(result.rows[0]?.total) || 0;
        res.json({ promedio: Math.round(total / 3), datos: [] });
    } catch (err) {
        console.error('[Dashboard] Error promedio mes:', err);
        res.json({ promedio: 0, datos: [] });
    }
};

// ============================================================================
// PROMEDIO SEMANAL (últimas 9 semanas)
// ============================================================================
// GET /api/excel/dashboard/promedio/semana
// ============================================================================
exports.dashboardPromedioSemana = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        const result = await pool.query(
            `SELECT COUNT(*) as total 
             FROM solicitudes 
             WHERE usuario_id = $1 
               AND fecha_solicitud >= CURRENT_DATE - INTERVAL '63 days'`,
            [usuarioId]
        );
        const total = parseInt(result.rows[0]?.total) || 0;
        res.json({ promedio: Math.round(total / 9), datos: [] });
    } catch (err) {
        console.error('[Dashboard] Error promedio semana:', err);
        res.json({ promedio: 0, datos: [] });
    }
};

// ============================================================================
// VENTAS MENSUALES (últimos 12 meses, solo ACTIVADAS)
// ============================================================================
// GET /api/excel/dashboard/ventas-mensuales
// ============================================================================
exports.dashboardVentasMensuales = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        const result = await pool.query(`
            SELECT 
                TO_CHAR(fecha_solicitud, 'YYYY-MM') as mes,
                TO_CHAR(fecha_solicitud, 'Mon YYYY') as mes_formato,
                COUNT(*) as total
            FROM solicitudes
            WHERE usuario_id = $1 
              AND estado = 'ACTIVADA'
              AND fecha_solicitud >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY TO_CHAR(fecha_solicitud, 'YYYY-MM')
            ORDER BY mes ASC
        `, [usuarioId]);

        res.json(result.rows);
    } catch (err) {
        console.error('[Dashboard] Error ventas mensuales:', err);
        res.json([]);
    }
};
