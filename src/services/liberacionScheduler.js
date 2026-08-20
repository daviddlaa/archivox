// ============================================================================
// SCHEDULER DE LIBERACIÓN - Alerta de solicitudes liberadas sin relación
// ============================================================================
// Revisa periódicamente las solicitudes en 'APROBADA PARA LIBERACIÓN' con más
// de 6 meses (fecha_solicitud) y sin relación activa (ALTA) con su usuario.
// Por cada usuario afectado:
//   1. Crea UNA notificación in-app resumiendo el total (deduplicada por día).
//   2. La emite por SSE (notification.created) + actualiza el contador.
//
// Ventana de deduplicación: no se crea una nueva alerta si ya existe una de la
// marca (título prefijo fijo) creada en las últimas 24h para ese usuario.
// ============================================================================

const pool = require('../config/db');
const notificationBus = require('./notificationBus');
const liberacionService = require('./liberacion.service');

// Cada 6 horas
const INTERVALO_MS = 6 * 60 * 60 * 1000;
// Ventana para no duplicar alertas del mismo usuario
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
// Marca fija en el título para localizar alertas previas (dedup)
const TITULO_PREFIJO = '⚠️ Solicitudes liberadas por reactivar';
const TABLA_FALTA = /does not exist|no such table/i;

function getRows(result) {
    if (result && result.rows) return result.rows;
    return result || [];
}

function getFirstRow(result) {
    const rows = getRows(result);
    return rows.length > 0 ? rows[0] : null;
}

// ============================================================================
// CREAR ALERTA DE LIBERACIÓN PARA UN USUARIO
// ============================================================================
async function crearAlerta(usuarioId, total) {
    const titulo = TITULO_PREFIJO + ' (' + total + ')';
    const mensaje = 'Llevan más de 6 meses en APROBADA PARA LIBERACIÓN sin relación activa. '
        + 'Si ese cliente compra, la venta no se refleja. Crea una campaña para activarlas sin compra.';
    const accionUrl = '/solicitudes?liberacion=1';

    // 1. Insertar la notificación (destinatario = usuario dueño de las solicitudes)
    const ins = await pool.query(
        `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, destinatario_id, accion_url, accion_texto, fecha_expiracion, accion_modulo, es_novedad, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [titulo, mensaje, 'warning', 'alta', usuarioId, usuarioId, accionUrl, 'Ver solicitudes', null, null, 0]
    );
    const newId = ins.lastInsertRowid;

    // 2. Emitir por SSE (mismo contrato que notificaciones.controller.js)
    const notificacion = {
        id: newId,
        titulo: titulo,
        mensaje: mensaje,
        tipo: 'warning',
        prioridad: 'alta',
        destinatario_id: usuarioId,
        accion_url: accionUrl,
        accion_texto: 'Ver solicitudes',
        accion_modulo: null,
        es_novedad: 0,
        fecha_expiracion: null,
        leida: 0,
        recordatorio_id: null,
        creador_username: null,
        created_at: new Date().toISOString()
    };
    notificationBus.emitir('notification.created', notificacion, usuarioId);
    notificationBus.emitirAUsuario('count.updated', { no_leidas: null }, usuarioId);

    return newId;
}

// ============================================================================
// PROCESAR ALERTAS PENDIENTES
// ============================================================================
// Devuelve false si el esquema aún no existe (para reintentar pronto), true si
// el pase se completó.
async function procesarAlertasLiberacion() {
    try {
        const resumen = await liberacionService.getResumenPorUsuario();
        const ahora = Date.now();
        let creadas = 0;

        for (const row of resumen) {
            try {
                const usuarioId = Number(row.usuario_id);
                const total = parseInt(row.total) || 0;
                if (!usuarioId || total <= 0) continue;

                // Dedup: ¿ya existe una alerta de liberación reciente para este usuario?
                const prev = await pool.query(
                    `SELECT MAX(created_at) as ultima FROM notificaciones
                     WHERE destinatario_id = ? AND tipo = 'warning' AND titulo LIKE ?`,
                    [usuarioId, TITULO_PREFIJO + '%']
                );
                const ultima = getFirstRow(prev);
                let yaAlertado = false;
                if (ultima && ultima.ultima) {
                    let fecha;
                    if (ultima.ultima instanceof Date) {
                        fecha = ultima.ultima;
                    } else {
                        fecha = new Date(String(ultima.ultima).replace(' ', 'T'));
                    }
                    if (!isNaN(fecha.getTime()) && ahora - fecha.getTime() < DEDUP_WINDOW_MS) {
                        yaAlertado = true;
                    }
                }

                if (yaAlertado) continue;

                await crearAlerta(usuarioId, total);
                creadas++;
            } catch (e) {
                console.error('[LiberaciónScheduler] Error procesando usuario #' + row.usuario_id + ':', e.message);
            }
        }

        if (creadas > 0) {
            console.log('[LiberaciónScheduler] Alertas de liberación creadas: ' + creadas);
        }
        return true;
    } catch (e) {
        if (TABLA_FALTA.test(e.message)) {
            return false;
        }
        console.error('[LiberaciónScheduler] Error general:', e.message);
        return true;
    }
}

// ============================================================================
// INICIAR SCHEDULER
// ============================================================================
function iniciarLiberacionScheduler() {
    let intervalo = null;
    let reintentos = 0;

    const arrancarCiclo = async () => {
        const ok = await procesarAlertasLiberacion();
        if (ok) {
            reintentos = 0;
            if (!intervalo) {
                intervalo = setInterval(procesarAlertasLiberacion, INTERVALO_MS);
                console.log('[LiberaciónScheduler] Scheduler de liberación activo (cada 6h)');
            }
            return;
        }
        if (++reintentos <= 6) {
            setTimeout(arrancarCiclo, 5000);
        } else if (!intervalo) {
            intervalo = setInterval(procesarAlertasLiberacion, INTERVALO_MS);
            console.log('[LiberaciónScheduler] Scheduler de liberación activo (cada 6h)');
        }
    };

    arrancarCiclo();
}

module.exports = {
    iniciarLiberacionScheduler,
    procesarAlertasLiberacion
};