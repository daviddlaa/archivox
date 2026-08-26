const express = require('express');
const router = express.Router();

const liberacionService = require('../services/liberacion.service');
const { requiresAuth } = require('../middleware/auth.middleware');

// ============================================================================
// RUTAS DE LIBERACIÓN / REACTIVACIÓN SIN COMPRA
// ============================================================================
// Solicitudes en 'APROBADA PARA LIBERACIÓN' con más de 6 meses que no tienen
// relación activa (ALTA) con su usuario. Si el cliente compra, la venta no se
// refleja. Estas rutas permiten alertar, listar y activar en lote (con o sin
// campaña).
// ============================================================================

function getUsuarioId(req) {
    return req.session && req.session.usuario ? req.session.usuario.id : null;
}

// GET /api/liberacion/contar - Cantidad para el banner de alerta + campaña automática
router.get('/contar', requiresAuth, async (req, res) => {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) return res.status(401).json({ error: 'No autenticado' });
        const total = await liberacionService.contarSolicitudesLiberacion(usuarioId);
        const campana = await liberacionService.getCampanaAutomatica(usuarioId);
        res.json({
            total: total,
            campana_automatica: campana ? { id: campana.id, total_solicitudes: campana.total_solicitudes } : null
        });
    } catch (err) {
        console.error('[Liberación] Error contar:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/liberacion - Listado paginado de solicitudes a reactivar
router.get('/', requiresAuth, async (req, res) => {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) return res.status(401).json({ error: 'No autenticado' });

        const { limite, offset, q } = req.query;
        const resultado = await liberacionService.getSolicitudesLiberacion(usuarioId, {
            limite: parseInt(limite) || 100,
            offset: parseInt(offset) || 0,
            q: q
        });
        res.json(resultado);
    } catch (err) {
        console.error('[Liberación] Error listar:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/liberacion/activar - Activar sin compra (con campaña opcional)
router.post('/activar', requiresAuth, async (req, res) => {
    try {
        const usuarioId = getUsuarioId(req);
        if (!usuarioId) return res.status(401).json({ error: 'No autenticado' });

        const payload = {
            ids: req.body && req.body.ids,
            crear_campana: req.body && req.body.crear_campana,
            nombre_campana: req.body && req.body.nombre_campana,
            descripcion: req.body && req.body.descripcion,
            fecha_limite: req.body && req.body.fecha_limite,
            equipo_id: (req.session.usuario && req.session.usuario.equipo_id) || null
        };

        const resultado = await liberacionService.activarSinCompra(usuarioId, payload);
        res.json({
            mensaje: resultado.activadas + ' solicitud(es) activada(s) sin compra',
            ...resultado
        });
    } catch (err) {
        console.error('[Liberación] Error activar:', err);
        if (err.message && /requerido|válidas/.test(err.message)) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;