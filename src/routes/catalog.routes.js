const express = require('express');
const router = express.Router();
const catalogService = require('../services/catalog.service');
const { requiresAuth } = require('../middleware/auth.middleware');

// GET /api/catalogos/estados
// Devuelve la lista de estados disponibles para el formulario Nueva Solicitud
router.get('/estados', requiresAuth, async (req, res) => {
    try {
        const usuarioId = req.session.usuario?.id;
        const estados = await catalogService.getEstados(usuarioId);
        res.json(estados);
    } catch (err) {
        console.error('[Catalogos] Error obteniendo estados:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/catalogos/segmentos
// Devuelve la lista de segmentos disponibles para el formulario Nueva Solicitud
router.get('/segmentos', requiresAuth, async (req, res) => {
    try {
        const usuarioId = req.session.usuario?.id;
        const segmentos = await catalogService.getSegmentos(usuarioId);
        res.json(segmentos);
    } catch (err) {
        console.error('[Catalogos] Error obteniendo segmentos:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
