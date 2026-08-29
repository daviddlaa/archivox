// ============================================================================
// CONTROLADOR DE SUSCRIPCIONES PUSH (Web Push API / VAPID)
// ============================================================================
// Gestión de suscripciones push por usuario:
//   GET    /api/push/vapid-public-key  → clave pública VAPID (para subscribirse)
//   POST   /api/push/subscribe         → guardar/actualizar una suscripción
//   DELETE /api/push/subscribe         → eliminar la suscripción del dispositivo
// ============================================================================

const pool = require('../config/db.js');
const { publicKey, configurado } = require('../config/pushConfig.js');

// ============================================================================
// OBTENER CLAVE PÚBLICA VAPID
// ============================================================================
exports.getVapidPublicKey = async (req, res) => {
    if (!configurado || !publicKey) {
        return res.status(503).json({ error: 'Push no configurado en este servidor' });
    }
    res.json({ publicKey });
};

// ============================================================================
// REGISTRAR / ACTUALIZAR SUSCRIPCIÓN
// ============================================================================
// Body: { endpoint, keys: { p256dh, auth }, plataforma }
// Upsert por (usuario_id, endpoint): el mismo dispositivo reconectado se
// actualiza en vez de duplicarse. Un usuario puede tener varias suscripciones
// (mismo navegador con varias cuentas = filas distintas por endpoint).
// ============================================================================
exports.subscribe = async (req, res) => {
    try {
        const { endpoint, keys, plataforma } = req.body || {};
        const usuarioId = req.session.usuario.id;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ error: 'Suscripción incompleta (endpoint, keys.p256dh, keys.auth requeridos)' });
        }

        // Validar formato del endpoint (http/https)
        if (!/^https:\/\//.test(endpoint)) {
            return res.status(400).json({ error: 'Endpoint inválido: debe ser https://' });
        }

        const userAgent = req.headers['user-agent'] || null;
        const plataformaFinal = plataforma === 'movil' ? 'movil' : 'desktop';

        const result = await pool.query(
            `INSERT INTO push_subscriptions (usuario_id, endpoint, keys_p256dh, keys_auth, plataforma, user_agent, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(usuario_id, endpoint)
             DO UPDATE SET keys_p256dh = excluded.keys_p256dh,
                           keys_auth = excluded.keys_auth,
                           plataforma = excluded.plataforma,
                           user_agent = excluded.user_agent,
                           updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [usuarioId, endpoint, keys.p256dh, keys.auth, plataformaFinal, userAgent]
        );

        const id = result.rows?.[0]?.id ?? result.lastInsertRowid ?? null;

        // El UPDATE de SQLite no devuelve id via lastInsertRowid; buscar si falta
        if (id === null) {
            const find = await pool.query(
                'SELECT id FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
                [usuarioId, endpoint]
            );
            return res.json({ mensaje: 'Suscripción actualizada', id: find.rows?.[0]?.id ?? null, suscrito: true });
        }

        res.json({ mensaje: 'Suscripción registrada', id, suscrito: true });
    } catch (err) {
        console.error('[Push] Error al suscribir:', err.message);
        res.status(500).json({ error: 'Error interno al guardar la suscripción' });
    }
};

// ============================================================================
// ELIMINAR SUSCRIPCIÓN (del dispositivo actual)
// ============================================================================
// Body opcional (por si el frontend ya perdió el endpoint): { endpoint }
// Sin body, elimina TODAS las suscripciones del usuario (logout completo).
// ============================================================================
exports.unsubscribe = async (req, res) => {
    try {
        const usuarioId = req.session.usuario.id;
        const { endpoint } = req.body || {};

        if (endpoint) {
            await pool.query(
                'DELETE FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
                [usuarioId, endpoint]
            );
        } else {
            await pool.query(
                'DELETE FROM push_subscriptions WHERE usuario_id = ?',
                [usuarioId]
            );
        }

        res.json({ mensaje: 'Suscripción(es) eliminada(s)', suscrito: false });
    } catch (err) {
        console.error('[Push] Error al dar de baja:', err.message);
        res.status(500).json({ error: 'Error interno al eliminar la suscripción' });
    }
};

// ============================================================================
// ESTADO DE LAS SUSCRIPCIONES DEL USUARIO (para el panel de Perfil)
// ============================================================================
exports.estado = async (req, res) => {
    try {
        const usuarioId = req.session.usuario.id;
        const result = await pool.query(
            'SELECT id, endpoint, plataforma, user_agent, updated_at FROM push_subscriptions WHERE usuario_id = ? ORDER BY updated_at DESC',
            [usuarioId]
        );
        res.json({
            configurado,
            activas: (result.rows || []).map((s) => ({
                id: s.id,
                plataforma: s.plataforma,
                user_agent: s.user_agent,
                updated_at: s.updated_at,
            })),
        });
    } catch (err) {
        console.error('[Push] Error consultando estado:', err.message);
        res.status(500).json({ error: 'Error interno al consultar suscripciones' });
    }
};