// ============================================================================
// RECORDATORIO SCHEDULER - Recordatorios de llamadas/mensajes vencidos
// ============================================================================
// Revisa cada 60s los recordatorios pendientes que ya vencieron y que aún no
// han sido notificados (notificado = 0). Por cada uno:
//   1. Crea una notificación in-app para el usuario que lo programó.
//   2. La emite por SSE (evento notification.created) para que salga el toast
//      en tiempo real y se actualice la campana de notificaciones.
//   3. Marca notificado = 1 para no duplicar.
//
// Convención de fechas: fecha_recordatorio se almacena como "YYYY-MM-DD HH:MM:SS"
// naive (igual que CURRENT_TIMESTAMP y el resto de la app). La comparación de
// vencimiento se hace en JS contra el reloj local del servidor.
//
// Nota Postgres: initDb.pg.js crea las tablas de forma ASÍNCRONA al arrancar,
// así que el primer pase puede ejecutarse antes de que exista la tabla. Por eso
// se reintenta cada 5s hasta que el esquema esté listo.
// ============================================================================

const pool = require('../config/db');
const notificationBus = require('./notificationBus');

// Cada 60 segundos
const INTERVALO_MS = 60 * 1000;
// Reintento corto si la tabla aún no existe (initDb async en PostgreSQL)
const REINTENTO_MS = 5 * 1000;
const MAX_REINTENTOS = 6;
// Patrón de error cuando la tabla no existe aún
const TABLA_FALTA = /does not exist|no such table/i;

function getRows(result) {
    if (result && result.rows) return result.rows;
    return result || [];
}

// ============================================================================
// PROCESAR RECORDATORIOS VENCIDOS
// ============================================================================
// Devuelve false si la tabla aún no existe (para reintentar pronto), true si
// el pase se completó (haya o no recordatorios vencidos).
async function procesarRecordatoriosVencidos() {
    try {
        const result = await pool.query(`
            SELECT r.*, s.nombre, s.celular
            FROM recordatorios r
            LEFT JOIN solicitudes s ON s.id_solicitud = r.solicitud_id
            WHERE r.estado = 'pendiente' AND r.notificado = 0
        `);
        const rows = getRows(result);

        const ahora = new Date();

        for (const rec of rows) {
            try {
                // Convertir "YYYY-MM-DD HH:MM:SS" naive a Date comparable.
                // En PostgreSQL la columna TIMESTAMP llega como objeto Date (ya en hora
                // local del servidor, equivalente al naive almacenado): usarlo directo.
                let fecha;
                if (rec.fecha_recordatorio instanceof Date) {
                    fecha = rec.fecha_recordatorio;
                } else {
                    fecha = new Date(String(rec.fecha_recordatorio || '').replace(' ', 'T'));
                }
                if (isNaN(fecha.getTime()) || fecha.getTime() > ahora.getTime()) {
                    continue;
                }

                const nombre = rec.nombre || 'cliente';
                const celular = rec.celular || '';
                const esMensaje = rec.canal === 'Mensaje';
                const titulo = '⏰ Recordatorio: ' + (esMensaje ? 'Mensaje' : 'Llamada');
                const mensaje = (esMensaje ? 'Enviar mensaje' : 'Llamar') + ' a ' + nombre
                    + (celular ? ' — ' + celular : '');
                const accionUrl = rec.gestion_maestro_id ? '/gestion-lote?id=' + rec.gestion_maestro_id : null;

                // 1. Insertar la notificación (destinatario = creador del recordatorio)
                const ins = await pool.query(`
                    INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, destinatario_id, accion_url, accion_texto, fecha_expiracion, accion_modulo, recordatorio_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [titulo, mensaje, 'warning', 'alta', rec.usuario_id, rec.usuario_id, accionUrl, 'Abrir campaña', null, null, rec.id]);

                const newId = ins.lastInsertRowid;

                // 2. Emitir por SSE (mismo contrato que notificaciones.controller.js)
                const notificacion = {
                    id: newId,
                    titulo: titulo,
                    mensaje: mensaje,
                    tipo: 'warning',
                    prioridad: 'alta',
                    destinatario_id: rec.usuario_id,
                    accion_url: accionUrl,
                    accion_texto: 'Abrir campaña',
                    accion_modulo: null,
                    es_novedad: 0,
                    fecha_expiracion: null,
                    leida: 0,
                    recordatorio_id: rec.id,
                    creador_username: null,
                    created_at: new Date().toISOString()
                };
                notificationBus.emitir('notification.created', notificacion, rec.usuario_id);

                // 3. Marcar como notificado (idempotente)
                await pool.query('UPDATE recordatorios SET notificado = 1 WHERE id = ?', [rec.id]);
            } catch (e) {
                console.error('[RecordatorioScheduler] Error procesando recordatorio #' + rec.id + ':', e.message);
            }
        }
        return true;
    } catch (e) {
        if (TABLA_FALTA.test(e.message)) {
            // El esquema aún se está creando (initDb async en Postgres): no es un error real
            return false;
        }
        console.error('[RecordatorioScheduler] Error general:', e.message);
        return true;
    }
}

// ============================================================================
// INICIAR SCHEDULER
// ============================================================================
function iniciarRecordatorioScheduler() {
    let intervalo = null;
    let reintentos = 0;

    const arrancarCiclo = async () => {
        const ok = await procesarRecordatoriosVencidos();
        if (ok) {
            reintentos = 0;
            if (!intervalo) {
                // Primera pasada exitosa: arrancar el ciclo cada 60s
                intervalo = setInterval(procesarRecordatoriosVencidos, INTERVALO_MS);
                console.log('[RecordatorioScheduler] Scheduler de recordatorios activo (cada 60s)');
            }
            return;
        }
        // Tabla aún no existe: reintentar pronto (máx. MAX_REINTENTOS antes de caer al intervalo)
        if (++reintentos <= MAX_REINTENTOS) {
            setTimeout(arrancarCiclo, REINTENTO_MS);
        } else if (!intervalo) {
            intervalo = setInterval(procesarRecordatoriosVencidos, INTERVALO_MS);
            console.log('[RecordatorioScheduler] Scheduler de recordatorios activo (cada 60s)');
        }
    };

    arrancarCiclo();
}

module.exports = {
    iniciarRecordatorioScheduler,
    procesarRecordatoriosVencidos
};
