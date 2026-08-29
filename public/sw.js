/* ============================================================================
 * ARCHIVOX SERVICE WORKER — Notificaciones push (Web Push API / VAPID)
 * ============================================================================
 * Se registra desde /sw.js (servido por express.static). Scope raíz '/' para
 * controlar toda la app pero SIN CACHÉ de HTML ni de respuestas de la API:
 * solo escucha eventos de push y de clic en notificaciones.
 *
 * Versionado: si cambias la lógica de este archivo, incrementa SW_VERSION. El
 * navegador detecta el nuevo script en la siguiente visita y llama skipWaiting
 * para activarlo de inmediato (evita SW viejos con URLs obsoletas).
 * ============================================================================
 */
'use strict';

var SW_VERSION = 1;
var ICONO = '/img/icono-192.png';
var ALOJAMIENTO = self.location.origin;

// Patrón simplificado de verificación de versión: se usa en el payload para
// depuración y en la notificación por si se necesita distinguir instalaciones.
var CACHE_PUSH = 'archivox-push-v' + SW_VERSION;

self.addEventListener('install', function (event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
    // Reclamar clientes controlados al activarse (aplica la versión nueva ya)
    event.waitUntil(self.clients.claim());
});

// ============================================================================
// EVENTO PUSH — Notificación entrante del servidor
// ============================================================================
// El payload llega cifrado (E2E) desde el push service; aquí ya está 
// descifrado por el navegador. Formato del JSON: { titulo, cuerpo, url, icono }
// Si el payload está vacío o no tiene título, se muestra un fallback.
// ============================================================================
self.addEventListener('push', function (event) {
    var titulo = 'Archivox';
    var opciones = {
        body: '',
        icon: ICONO,
        badge: ICONO,
        lang: 'es',
        data: { url: null, fecha: Date.now() },
    };

    if (event.data) {
        try {
            var datos = event.data.json();
            if (datos && datos.titulo) {
                titulo = datos.titulo;
                opciones.body = datos.cuerpo || '';
                opciones.data.url = datos.url || null;
                opciones.data.fecha = Date.now();
                opciones.silent = false;
            }
        } catch (err) {
            // Payload no-JSON: usar texto plano como cuerpo
            opciones.body = event.data.text() || '';
        }
    }

    event.waitUntil(self.registration.showNotification(titulo, opciones));

    // Avisa a las pestañas abiertas para que la app pueda refrescarse al recibir
    // un push (informativo; ninguna página está obligada a escucharlo).
    opciones.data.broadcast = true;
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        for (var i = 0; i < clients.length; i++) {
            clients[i].postMessage({ tipo: 'push-recibido', titulo: titulo, url: opciones.data.url });
        }
    });
});

// ============================================================================
// CLIC EN NOTIFICACIÓN — Abrir la URL de acción correcta
// ============================================================================
// La URL ya viene adaptada por el servidor a la plataforma de la suscripción
// (desktop: /gestion-lote?id=5 | móvil: /m/gestion-lote?id=5). Si hay un
// cliente abierto de la app, se enfoca y se navega; si no, se abre una pestaña.
// ============================================================================
self.addEventListener('notificationclick', function (event) {
    var destino = (event.notification.data && event.notification.data.url) || '/';
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url.indexOf(ALOJAMIENTO) === 0) {
                    // Cliente ya abierto: enfocar y navegar
                    return client.navigate(destino).then(function () {
                        return client.focus();
                    }).catch(function () {
                        // navigate puede fallar por URL fuera de scope
                        return client.focus();
                    });
                }
            }
            return self.clients.openWindow(destino);
        })
    );
});

// Cerrar notificaciones al descartarlas (evita basura de notificaciones)
self.addEventListener('notificationclose', function (event) {
    event.waitUntil(event.notification.close());
});