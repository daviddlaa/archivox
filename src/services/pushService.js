// ============================================================================
// PUSH SERVICE — Envío de notificaciones push (Web Push API / VAPID)
// ============================================================================
// Encargado de entregar notificaciones push a las suscripciones de cada usuario
// usando la librería web-push (cifrado E2E + VAPID).
//
// Reglas:
//   - Solo se envían push a notificaciones con DESTINATARIO CONCRETO
//     (destinatario_id). Las notificaciones globales NO disparan push.
//   - Fire-and-forget: el envío nunca bloquea ni rompe el flujo principal.
//   - Las suscripciones expiradas (HTTP 404/410) se borran de la BD.
// ============================================================================

const webpush = require('web-push');
const pool = require('../config/db.js');
const { publicKey, privateKey, subject, configurado } = require('../config/pushConfig.js');

if (configurado) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
}

// ============================================================================
// OBTENER SUSCRIPCIONES ACTIVAS DE UN USUARIO
// ============================================================================
async function getSuscripciones(usuarioId) {
    const result = await pool.query(
        'SELECT id, endpoint, keys_p256dh, keys_auth, plataforma FROM push_subscriptions WHERE usuario_id = ?',
        [usuarioId]
    );
    return result.rows || [];
}

// ============================================================================
// BORRAR UNA SUSCRIPCIÓN (expirada / inválida / desactivada)
// ============================================================================
async function eliminarSuscripcion(suscripcionId) {
    try {
        await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [suscripcionId]);
    } catch (err) {
        console.error('[Push] Error al eliminar suscripción #' + suscripcionId + ':', err.message);
    }
}

// ============================================================================
// URL PARA PLATAFORMA (equivalente a DeepLinkRouter.corregirUrl en el servidor)
// ============================================================================
// Convierte una URL de acción (formato servidor/desktop) a la variante correcta
// según la plataforma de la suscripción:
//   desktop: '/gestion-lote?id=5'   → '/gestion-lote?id=5'
//   movil:   '/gestion-lote?id=5'   → '/m/gestion-lote?id=5'
// Rutas compartidas (/perfil, /admin, /login) no se tocan.
// ============================================================================
function urlParaPlataforma(url, plataforma) {
    if (!url || url[0] !== '/') return url || null;

    const rutasCompartidas = ['/perfil', '/admin', '/login'];
    const pathname = url.split('?')[0];
    const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';

    if (rutasCompartidas.indexOf(pathname) !== -1) return url;

    if (plataforma === 'movil') {
        if (pathname === '/m' || pathname.startsWith('/m/')) return url;
        return '/m' + pathname + query;
    }
    // desktop
    if (pathname === '/m') return query || '/';
    if (pathname.startsWith('/m/')) return pathname.slice(2) + query;
    return url;
}

// ============================================================================
// PAYLOAD DESDE UNA NOTIFICACIÓN DEL SISTEMA
// ============================================================================
// Convierte el objeto `notificacion` (mismo contrato que SSE) al payload de
// push. Solo envia si la notificación tiene DESTINATARIO CONCRETO (las
// notificaciones globales destinatario_id null NO disparan push).
// ============================================================================
function payloadDesdeNotificacion(notificacion) {
    if (!notificacion || !notificacion.titulo) return null;
    if (!notificacion.destinatario_id) return null;   // globales: sin push

    // La URL se adapta por plataforma en el momento de enviar (urlParaPlataforma)
    return {
        titulo: notificacion.titulo,
        cuerpo: notificacion.mensaje || '',
        url: notificacion.accion_url || null,
        icono: notificacion.accion_modulo || null,
    };
}

// ============================================================================
// ENVIAR PUSH A UN USUARIO (todas sus suscripciones activas)
// ============================================================================
// payload: { titulo, cuerpo, url: nombreDeModuloOUrl, icono }
//   - `url` puede ser una URL de acción (/gestion-lote?id=5) o el nombre de un
//     módulo ('solicitudes'); se adapta según la plataforma de cada suscripción
//     y se convierte a URL por el SW (win.url).
// Solo se envía si hay configuración VAPID completa. Si no hay suscripciones
// o no está configurado, no hace nada (no es un error).
// ============================================================================
async function enviarPushAUsuario(usuarioId, payload) {
    if (!configurado) return false;
    if (!usuarioId) return false;

    const { titulo, cuerpo, url, icono } = payload || {};
    if (!titulo) return false;

    let suscripciones;
    try {
        suscripciones = await getSuscripciones(usuarioId);
    } catch (err) {
        console.error('[Push] Error consultando suscripciones del usuario #' + usuarioId + ':', err.message);
        return false;
    }

    if (!suscripciones.length) return false;

    let enviadas = 0;
    for (const sub of suscripciones) {
        try {
            const urlFinal = urlParaPlataforma(url, sub.plataforma);
            const data = JSON.stringify({
                titulo: titulo,
                cuerpo: cuerpo || '',
                url: urlFinal || null,
                icono: icono || null,
            });
            await webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.keys_p256dh,
                        auth: sub.keys_auth,
                    },
                },
                data
            );
            enviadas++;
        } catch (err) {
            // Suscripción expirada o dada de baja por el push service → limpiar
            if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 400) {
                console.log('[Push] Suscripción expirada/inválida (#%s), eliminando…', sub.id);
                await eliminarSuscripcion(sub.id);
            } else {
                // Error de red / push service caído → reintento natural en el próximo ciclo
                console.warn('[Push] Error enviando a endpoint %s: %s', sub.endpoint, err.message);
            }
        }
    }

    return enviadas > 0;
}

// ============================================================================
// ENVIAR PUSH DESDE UNA NOTIFICACIÓN IN-APP (hook de los emisores SSE)
// ============================================================================
async function enviarPushDesdeNotificacion(notificacion) {
    const payload = payloadDesdeNotificacion(notificacion);
    if (!payload) return false;
    // Fire-and-forget: nunca esperado por quien emite (no debe frenar el flujo).
    try {
        return await enviarPushAUsuario(notificacion.destinatario_id, payload);
    } catch (err) {
        console.error('[Push] Error global enviando push:', err.message);
        return false;
    }
}

module.exports = {
    enviarPushAUsuario,
    enviarPushDesdeNotificacion,
    payloadDesdeNotificacion,
    urlParaPlataforma,
    getSuscripciones,
    eliminarSuscripcion,
};