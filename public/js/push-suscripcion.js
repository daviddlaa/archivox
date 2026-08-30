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

    // True en un dispositivo Apple (iPhone/iPad/iPod) incluso con iPadOS que
    // envía userAgent de escritorio (MacIntel + pantalla táctil)
    function esApple() {
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
        // iPadOS 13+ en Safari: userAgent de Mac pero con touch 3D/multi
        if (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) return true;
        return false;
    }

    // True en Safari/Chromium en una PWA instalada (display-mode standalone)
    function esPWAInstalada() {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            navigator.standalone === true
        );
    }

    // True en un dispositivo Apple en pestaña NORMAL (no PWA): push NO
    // disponible → guía de instalación. Se calcula SIN requerir soporte de
    // push porque en iOS la propia API puede existir pero rechazar la
    // suscripción fuera de la PWA ("Registration failed - push service error").
    function esIOSEnPestana() {
        return esApple() && !esPWAInstalada();
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
            return suscribirseConReintento(registration, vapidKey);
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

    // Chrome/FCM lanza "Registration failed - push service error" cuando:
    //  a) hay una suscripción vieja del mismo service worker creada con OTRA
    //     aplicacionServerKey,
    //  b) FCM responde mal/transitoriamente tras conceder el permiso (Android),
    //  c) la registración del service worker en Chrome quedó ROTA de un
    //     despliegue previo (caso real en móvil: nada en la BD ni en el
    //     navegador, y subscribir falla siempre).
    // Se reintenta con pausas, se limpia la suscripción obsoleta y, si aún
    // falla, se desregistra el SW y se registra de nuevo ("borrar y rehacer").
    function suscribirseConReintento(registration, vapidKey) {
        function key() {
            return urlBase64ToUint8Array(vapidKey);
        }
        function intentar() {
            return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
        }
        function suscribirEn(reg) {
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
        }
        function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
        // Desregistra el SW roto, vuelve a registrarlo y espera a que quede activo.
        function resetServiceWorker() {
            return registration.unregister().catch(function () { return false; })
                .then(function () { return espera(400); })
                .then(registrarSW)
                .then(function () {
                    return espera(300).then(function () { return navigator.serviceWorker.ready; });
                });
        }
        function esErrorServicio(err) {
            return !!err && /push service error|registration failed/i.test(String(err.message));
        }
        return intentar().catch(function (err1) {
            if (!esErrorServicio(err1)) throw err1;
            // 2º intento (permiso Android propagándose / FCM transitorio)
            return espera(250).then(intentar).catch(function () {
                // Limpiar una suscripción vieja con otra clave y reintentar
                return registration.pushManager.getSubscription().then(function (vieja) {
                    if (!vieja) return resetServiceWorker().then(suscribirEn).catch(function () { throw err1; });
                    return vieja.unsubscribe().then(function (ok) {
                        if (!ok) return resetServiceWorker().then(suscribirEn).catch(function () { throw err1; });
                        return espera(500).then(intentar).catch(function () {
                            return resetServiceWorker().then(suscribirEn).catch(function () { throw err1; });
                        });
                    }, function () {
                        return resetServiceWorker().then(suscribirEn).catch(function () { throw err1; });
                    });
                }).catch(function () {
                    return resetServiceWorker().then(suscribirEn).catch(function () { throw err1; });
                });
            });
        });
    }

    // Convierte el error técnico del navegador en un mensaje accionable.
    function mensajeErrorSuscripcion(msg) {
        if (!msg) return 'inténtalo de nuevo.';
        var m = String(msg);
        if (/push service error|registration failed/i.test(m)) {
            return detectarPlataforma() === 'movil'
                ? 'el navegador no pudo conectarse al servicio de notificaciones. Verifica tu conexión, actualiza Chrome y los servicios de Google, o prueba con otra red (datos móviles o WiFi).'
                : 'el servicio de notificaciones del navegador no respondió. Verifica tu conexión e inténtalo de nuevo.';
        }
        return m + '.';
    }

    // ============================================================================
    // FLUJO COMPLETO DE SUSCRIPCIÓN (llamar DENTRO de un gesto del usuario)
    // ============================================================================
    // Resuelve un objeto:
    //   { estado: 'suscrito' | 'ya-suscrito' | 'denegado' | 'no-soporte' | 'error', error? }
    // ============================================================================
    function solicitar() {
        if (esIOSEnPestana()) return Promise.resolve({ estado: 'ios-pestana' });
        if (!soportado()) return Promise.resolve({ estado: 'no-soporte' });

        // Ya con permiso: solo asegurar la suscripción en el navegador + BD
        if (Notification.permission === 'granted') {
            return registrarSW().then(function (registration) {
                return registrarse(registration);
            }).then(function () {
                return { estado: 'ya-suscrito' };
            }).catch(function (err) {
                console.error('[Push] Error en solicitar (ya con permiso):', err);
                return { estado: 'error', error: err.message };
            });
        }

        if (Notification.permission === 'denied') {
            return Promise.resolve({ estado: 'denegado' });
        }

        // permission === 'default': pedir el permiso ANTES de cualquier await,
        // dentro del gesto del clic (Chrome/Firefox exigen la activación vigente).
        return Notification.requestPermission().then(function (permiso) {
            if (permiso !== 'granted') return { estado: 'denegado' };
            return registrarSW().then(function (registration) {
                return registrarse(registration);
            }).then(function () {
                return { estado: 'suscrito' };
            }).catch(function (err) {
                console.error('[Push] Error tras conceder permiso:', err);
                return { estado: 'error', error: err.message };
            });
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
                        try { mostrarToast('🔔 Listo: recibirás notificaciones aquí'); } catch (e) { /* sin toast */ }
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
                        // 'error' | 'no-soporte': re-habilitar y mostrar una
                        // explicación accionable (nunca el error técnico crudo)
                        if (banner) {
                            var tie3 = banner.querySelector('.push-banner-info');
                            if (tie3) tie3.textContent = r.estado === 'no-soporte'
                                ? 'Este navegador no soporta notificaciones push.'
                                : 'No se pudo activar: ' + mensajeErrorSuscripcion(r.error) + ' Inténtalo otra vez.';
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
        // En iPhone/iPad en pestaña normal el push NO está disponible:
        // mostrar la guía de instalación PWA (una vez por navegador).
        if (esIOSEnPestana()) {
            if (localStorage.getItem(LS_BANNER)) return null;
            var contIOS = crearBanner(
                '<div class="push-banner-inner">' +
                    '<span class="push-banner-icono">📱</span>' +
                    '<span class="push-banner-info">En iPhone/iPad: abre "Compartir" → <b>"Añadir a Pantalla de Inicio"</b> para recibir las notificaciones.</span>' +
                    '<button type="button" class="push-banner-cerrar" aria-label="Cerrar">✕</button>' +
                '</div>',
                {}
            );
            var closeIOS = contIOS.querySelector('.push-banner-cerrar');
            if (closeIOS) {
                closeIOS.addEventListener('click', function () {
                    localStorage.setItem(LS_BANNER, '1');
                    contIOS.remove();
                });
            }
            global.document.body.appendChild(contIOS);
            return contIOS;
        }

        if (!soportado()) return null;
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
        // En iPhone/iPad en pestaña normal el push NO está disponible (aunque
        // PushManager exista en iOS 16.4+): se avisa cómo instalar la PWA.
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

        if (!soportado()) return null;

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
        errorLegible: mensajeErrorSuscripcion,
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