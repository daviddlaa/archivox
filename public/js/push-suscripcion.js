// ============================================================================
// PUSH SUSCRIPCIÓN — Notificaciones push web (Web Push API / VAPID)
// ============================================================================
// Lógica compartida de suscripción/desuscripción a notificaciones push.
// Se carga en las páginas autenticadas (como notificaciones-dashboard.js).
//
// Uso:
//   PushNotif.soportado()                  → ¿el navegador soporta push?
//   PushNotif.registrarSW()                → registra /sw.js (silencioso)
//   PushNotif.solicitar()                  → flujo completo con prompt (requiere
//                                            gesto del usuario: clic en un botón)
//   PushNotif.desactivar()                 → da de baja la suscripción
//   PushNotif.bannerDashboard()            → banner one-time en el dashboard
//   PushNotif.bannerTrasRecordatorio()     → banner contextual al guardar recordatorio
//
// Reglas de navegadores:
//   - Chrome/Edge/Firefox (desktop) y Chrome Android: soporte completo.
//   - Safari iOS (16.4+): SOLO si la app está instalada en Home Screen (PWA).
//     En pestaña normal de Safari NO hay push → mostramos la guía de instalación.
//   - El prompt de permiso solo puede dispararse con gesto del usuario (clic).
// ============================================================================
(function (global) {
    'use strict';

    var SW_PATH = '/sw.js';
    var LS_BANNER = 'archivox_push_banner_visto';

    // ============================================================================
    // DETECCIÓN DE SOPORTE
    // ============================================================================
    function esHTTPS() {
        return window.isSecureContext === true;
    }

    function soportado() {
        // HTTPS es obligatorio (excepto localhost durante desarrollo).
        if (!esHTTPS()) return false;
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    // True en Safari/Chromium en una PWA instalada (display-mode standalone)
    function esPWAInstalada() {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            navigator.standalone === true
        );
    }

    // True en iOS Safari en pestaña normal (no PWA): push NO disponible
    function esIOSEnPestana() {
        if (!soportado()) return false;
        var esIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        return esIOS && !esPWAInstalada();
    }

    function estadoPermiso() {
        if (!soportado()) return 'no-soporte';
        return Notification.permission; // 'granted' | 'denied' | 'default'
    }

    // ============================================================================
    // PLATAFORMA (para el backend: /m/* → 'movil')
    // ============================================================================
    function detectarPlataforma() {
        var p = window.location.pathname;
        if (p === '/m' || p.indexOf('/m/') === 0) return 'movil';
        return 'desktop';
    }

    // ============================================================================
    // UTILIDADES
    // ============================================================================
    function urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        var rawData = window.atob(base64);
        var outputArray = new Uint8Array(rawData.length);
        for (var i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // ============================================================================
    // REGISTRAR SERVICE WORKER
    // ============================================================================
    function registrarSW() {
        if (!soportado()) return Promise.reject(new Error('Push no soportado'));
        return navigator.serviceWorker.register(SW_PATH).catch(function (err) {
            console.error('[Push] No se pudo registrar el service worker:', err);
            throw err;
        });
    }

    // ============================================================================
    // OBTENER CLAVE PÚBLICA VAPID (req autenticada, cookie de sesión)
    // ============================================================================
    function obtenerVapidKey() {
        return fetch('/api/push/vapid-public-key', { credentials: 'same-origin' })
            .then(function (res) {
                if (!res.ok) throw new Error('No se pudo obtener la clave de push');
                return res.json();
            })
            .then(function (data) {
                if (!data || !data.publicKey) throw new Error('Clave de push vacía');
                return data.publicKey;
            });
    }

    // ============================================================================
    // SUSCRIBIRSE REALMENTE (crea suscripción PushManager + la guarda en BD)
    // ============================================================================
    function crearSuscripcion(registration) {
        return obtenerVapidKey().then(function (vapidKey) {
            return registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
        }).then(function (suscripcion) {
            // Guardar en el backend (upsert por usuario+endpoint)
            return fetch('/api/push/subscribe', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: suscripcion.endpoint,
                    keys: {
                        p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(suscripcion.getKey('p256dh')))),
                        auth: btoa(String.fromCharCode.apply(null, new Uint8Array(suscripcion.getKey('auth')))),
                    },
                    plataforma: detectarPlataforma(),
                }),
            }).then(function (res) {
                if (!res.ok) throw new Error('Error al guardar la suscripción');
                return res.json();
            });
        });
    }

    // ============================================================================
    // FLUJO COMPLETO DE SUSCRIPCIÓN (llamar DENTRO de un gesto del usuario)
    // ============================================================================
    // Resuelve un objeto:
    //   { estado: 'suscrito' | 'ya-suscrito' | 'denegado' | 'no-soporte' | 'error', error? }
    // ============================================================================
    function solicitar() {
        if (!soportado()) return Promise.resolve({ estado: 'no-soporte' });
        if (esIOSEnPestana()) return Promise.resolve({ estado: 'ios-pestana' });

        // Si ya están suscritos y en la BD, no hacer nada ruidoso
        return registrarSW().then(function (registration) {
            if (Notification.permission === 'granted') {
                return registration.pushManager.getSubscription().then(function (existe) {
                    if (existe) {
                        // Asegurar que la BD conoce la suscripción (upsert idempotente)
                        return sincronizarBD(existe).then(function () {
                            return { estado: 'ya-suscrito' };
                        });
                    }
                    return crearSuscripcion(registration).then(function () {
                        return { estado: 'suscrito' };
                    });
                });
            }

            if (Notification.permission === 'denied') {
                return Promise.resolve({ estado: 'denegado' });
            }

            // permission === 'default' → pedir permiso (requiere gesto; aquí se llama desde un clic)
            return Notification.requestPermission().then(function (permiso) {
                if (permiso !== 'granted') {
                    return { estado: 'denegado' };
                }
                return registrarse(registration).then(function () {
                    return { estado: 'suscrito' };
                }, function () {
                    return { estado: 'error' };
                });
            });
        }).catch(function (err) {
            console.error('[Push] Error en solicitar:', err);
            return { estado: 'error', error: err.message };
        });
    }

    function registrarse(registration) {
        return registration.pushManager.getSubscription().then(function (existe) {
            if (existe) return sincronizarBD(existe);
            return crearSuscripcion(registration);
        });
    }

    // Upsert idempotente en la BD de una suscripción ya existente en el navegador
    function sincronizarBD(suscripcion) {
        return fetch('/api/push/subscribe', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: suscripcion.endpoint,
                keys: {
                    p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(suscripcion.getKey('p256dh')))),
                    auth: btoa(String.fromCharCode.apply(null, new Uint8Array(suscripcion.getKey('auth')))),
                },
                plataforma: detectarPlataforma(),
            }),
        }).then(function (res) {
            if (!res.ok) throw new Error('Error al sincronizar la suscripción');
            return res.json();
        });
    }

    // ============================================================================
    // DESACTIVAR SUSCRIPCIÓN (logout / opcional en Perfil)
    // ============================================================================
    function desactivar() {
        if (!soportado()) return Promise.resolve();
        return navigator.serviceWorker.getRegistration().then(function (reg) {
            var promesas = [];
            if (reg) {
                promesas.push(
                    reg.pushManager.getSubscription().then(function (sub) {
                        if (!sub) return null;
                        var endpoint = sub.endpoint;
                        return sub.unsubscribe().then(function () {
                            return endpoint;
                        });
                    })
                );
            }
            return Promise.all(promesas).then(function (resultados) {
                // Resultados[0] es el endpoint dado de baja (si existía)
                return fetch('/api/push/subscribe', {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: resultados[0] || undefined }),
                });
            });
        }).catch(function (err) {
            console.error('[Push] Error al desactivar:', err);
        });
    }

    // ============================================================================
    // HELPERS DE UI (banners) — sin librerías, DOM vanilla
    // ============================================================================
    function crearBanner(html, claves) {
        var contenedor = document.createElement('div');
        contenedor.className = 'push-banner';
        contenedor.innerHTML = html;
        // Enlazar acciones por data-atributo (estilo de la app: sin frameworks)
        Object.keys(claves || {}).forEach(function (k) {
            var el = contenedor.querySelector('[data-accion="' + k + '"]');
            if (el) el.addEventListener('click', claves[k]);
        });
        return contenedor;
    }

    function botonAccion() {
        return {
            solicitar: function (ev) {
                var banner = ev.currentTarget.closest('.push-banner');
                var btn = banner ? banner.querySelector('.push-banner-btn') : null;
                if (btn) btn.disabled = true;
                solicitar().then(function (r) {
                    if (r.estado === 'suscrito' || r.estado === 'ya-suscrito') {
                        if (banner) banner.remove();
                        mostrarToast('🔔 Listo: recibirás notificaciones aquí');
                    } else if (r.estado === 'denegado') {
                        if (banner) {
                            var tie = banner.querySelector('.push-banner-info');
                            if (tie) tie.textContent = 'Permiso bloqueado en este navegador. Puedes activarlo desde su configuración.';
                        }
                    } else if (r.estado === 'ios-pestana') {
                        if (banner) {
                            var tie2 = banner.querySelector('.push-banner-info');
                            if (tie2) tie2.textContent = 'En iPhone/iPad, abre "Compartir" → "Añadir a Pantalla de Inicio" para activar notificaciones.';
                        }
                    } else {
                        // 'error' | 'no-soporte': re-habilitar y explicar (no dejar
                        // el botón muerto sin feedback)
                        if (banner) {
                            var tie3 = banner.querySelector('.push-banner-info');
                            if (tie3) tie3.textContent = r.estado === 'no-soporte'
                                ? 'Este navegador no soporta notificaciones push.'
                                : 'No se pudo activar. Revisa tu conexión e inténtalo de nuevo.';
                        }
                        if (btn) btn.disabled = false;
                    }
                });
            },
        };
    }

    // Toast genérico (reutiliza el de notificaciones-dashboard si existe)
    function mostrarToast(mensaje) {
        if (global.mostrarToastSimple) return global.mostrarToastSimple(mensaje);
        if (global.Notification && global.Notification.status === 'granted') {
            try {
                new Notification('Archivox', { body: mensaje, icon: '/img/icono-192.png' });
                return;
            } catch (e) { /* fallthrough */ }
        }
        global.alert(mensaje);
    }

    // ============================================================================
    // BANNER ONE-TIME DEL DASHBOARD
    // ============================================================================
    // Solo aparece si:
    //   - el navegador soporta push
    //   - el permiso está en 'default' (aún no se ha decidido)
    //   - no se ha mostrado antes en este navegador (localStorage)
    // El clic en el botón es el GESTO que destraba el prompt en Firefox/iOS.
    // ============================================================================
    function bannerDashboard() {
        if (!soportado()) return null;
        if (esIOSEnPestana()) return null; // la guía se muestra mejor en Contextual
        if (estadoPermiso() !== 'default') return null;
        if (localStorage.getItem(LS_BANNER)) return null;

        var acciones = botonAccion();
        var cont = crearBanner(
            '<div class="push-banner-inner">' +
                '<span class="push-banner-icono">🔔</span>' +
                '<span class="push-banner-info">Activa las notificaciones push para no perderte recordatorios y alertas aunque cierres la pestaña.</span>' +
                '<button type="button" class="push-banner-btn" data-accion="solicitar">Activar notificaciones</button>' +
                '<button type="button" class="push-banner-cerrar" aria-label="Cerrar">✕</button>' +
            '</div>',
            { solicitar: acciones.solicitar }
        );

        var close = cont.querySelector('.push-banner-cerrar');
        if (close) {
            close.addEventListener('click', function () {
                localStorage.setItem(LS_BANNER, '1');
                cont.remove();
            });
        }
        global.document.body.appendChild(cont);
        return cont;
    }

    // ============================================================================
    // BANNER CONTEXTUAL (tras guardar un recordatorio / en gestion-lote)
    // ============================================================================
    // Misma regla que el dashboard, pero se puede reinvocar tras cada guardado.
    // En iOS pestaña muestra la guía de instalación PWA.
    // ============================================================================
    function bannerTrasRecordatorio() {
        if (!soportado()) return null;

        if (esIOSEnPestana()) {
            return crearBanner(
                '<div class="push-banner-inner">' +
                    '<span class="push-banner-icono">📱</span>' +
                    '<span class="push-banner-info">En iPhone/iPad: abre "Compartir" → <b>"Añadir a Pantalla de Inicio"</b> para que el recordatorio te avise como notificación.</span>' +
                    '<button type="button" class="push-banner-cerrar" aria-label="Cerrar">✕</button>' +
                '</div>',
                {}
            );
        }

        if (estadoPermiso() === 'granted') return null; // ya suscrito, no molestar
        if (estadoPermiso() === 'denied') return null;

        var acciones = botonAccion();
        return crearBanner(
            '<div class="push-banner-inner">' +
                '<span class="push-banner-icono">🔔</span>' +
                '<span class="push-banner-info">¿Quieres que te avisemos aquí cuando venza el recordatorio?</span>' +
                '<button type="button" class="push-banner-btn" data-accion="solicitar">Sí, activar</button>' +
                '<button type="button" class="push-banner-cerrar" aria-label="Cerrar">✕</button>' +
            '</div>',
            { solicitar: acciones.solicitar }
        );
    }

    // ============================================================================
    // API PÚBLICA
    // ============================================================================
    global.PushNotif = {
        soportado: soportado,
        esPWAInstalada: esPWAInstalada,
        esIOSEnPestana: esIOSEnPestana,
        estadoPermiso: estadoPermiso,
        registrarSW: registrarSW,
        solicitar: solicitar,
        desactivar: desactivar,
        bannerDashboard: bannerDashboard,
        bannerTrasRecordatorio: bannerTrasRecordatorio,
    };

    // ============================================================================
    // AUTO-INICIALIZACIÓN (este script se carga con `defer` → DOM ya está listo)
    // ============================================================================
    // 1. Registra el service worker en silencio (sin pedir permisos).
    // 2. En el dashboard muestra el banner one-time si aplica.
    // 3. Escucha el evento 'archivox:recordatorio-guardado' para mostrar el
    //    banner contextual al guardar un recordatorio (disparado por las páginas
    //    de gestión por lote, desktop y móvil).
    // ============================================================================
    (function autoInit() {
        if (!soportado()) return;

        // Registro silencioso del SW (nunca pide permiso por sí solo)
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', function () {
                registrarSW().catch(function () { /* silencioso */ });
            });
        } else {
            registrarSW().catch(function () { /* silencioso */ });
        }

        // Dashboard (ruta raíz desktop '/', móvil '/m')
        var ruta = global.location.pathname;
        if (ruta === '/' || ruta === '/m') {
            // Small delay: el banner no debe chocar con el render del dashboard
            setTimeout(function () { bannerDashboard(); }, 1500);
        }

        // Banner contextual tras guardar un recordatorio
        global.document.addEventListener('archivox:recordatorio-guardado', function () {
            var banner = bannerTrasRecordatorio();
            if (banner) global.document.body.appendChild(banner);
        });
    })();

})(window);