# Feature: Historial general de campaña — botón "🕘 Últimas gestiones"

**Fecha:** Agosto 2026
**Ámbito:** `src/controllers/gestionesMaestro.controller.js`, `src/routes/gestionesMaestro.routes.js`,
`public/movil/gestion-lote.html`, `public/movil/js/gestion-lote.js`,
`public/desktop/gestion-lote.html`, `public/desktop/js/gestion-lote.js`,
`public/css/gestion-lote.css`
**Solicitud:** Poder consultar el historial completo de gestiones de una campaña (todas sus
solicitudes) tanto en móvil como en escritorio, con un botón único "🕘 Últimas gestiones".

---

## 1. Resumen

Se añadió un endpoint compartido que devuelve el historial general de una campaña y un botón
**"🕘 Últimas gestiones"** en ambas plataformas que abre un modal con ese historial. En
escritorio, este botón **reemplaza el widget de prioridad** ("Prioridad / Seguimiento (N) /
Ver") que ocupaba el rail lateral: se elimina el indicador de prioridad y queda un botón píldora
de ancho completo que abre el mismo modal. El usuario aprobó unificar el texto en
"Últimas gestiones" en ambas plataformas.

---

## 2. Backend

### 2.1 Endpoint `GET /api/gestiones-maestro/:id/historial`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/gestiones-maestro/:id/historial` | ✅ | Historial general de la campaña |

- **Controlador:** `getHistorialGeneralCampana` en `src/controllers/gestionesMaestro.controller.js`
  (exportado como `historialGeneralCampana`).
- **Ruta:** `router.get('/:id/historial', ...)` en `src/routes/gestionesMaestro.routes.js`.
- **Respuesta:** `{ gestion, gestiones }` donde `gestion` es la campaña (para su nombre) y
  `gestiones` es la lista de gestiones de la campaña (todas sus solicitudes), cada una con
  `solicitud_id`, `tipo_gestion`, `fecha_gestion`, `observacion` y datos de la solicitud.
- Sin sesión devuelve 401 (ruta protegida por `requiresAuth`).

---

## 3. Frontend

### 3.1 Móvil

- **Botón:** `#btn-historial-campana-movil` en `public/movil/gestion-lote.html` (junto al
  selector de campaña del header, clases `header-prioridad-btn header-historial-btn`,
  oculto hasta que se carga la campaña).
- **JS:** `mostrarBotonHistorialCampanaMovil()` (lo muestra) y `abrirHistorialCampanaMovil()`
  (abre el modal vía `crearModal`, llama al endpoint y lista las gestiones; cada gestión abre
  la tarjeta de su solicitud).
- Llamada a `mostrarBotonHistorialCampanaMovil()` tras cargar los datos de la campaña.

### 3.2 Escritorio

- **Botón:** `#btn-historial-campana` en `public/desktop/gestion-lote.html`, clase
  `historial-campana-btn`, `onclick="abrirHistorialCampanaDesktop()"`, oculto hasta que se
  carga la campaña.
- **JS:** `mostrarBotonHistorialCampanaDesktop()` (lo muestra, llamado tras
  `actualizarProgreso()` en `cargarDatosGestion`), `abrirHistorialCampanaDesktop()` (modal con
  el mismo endpoint) y `navegarACardDesktop(solicitudId)` (al hacer clic en una gestión navega
  y resalta su tarjeta en la lista).
- **CSS:** píldora `.historial-campana-btn` en `public/css/gestion-lote.css` (fondo amarillo
  degradado, texto oscuro `#78350f`, borde `#facc15`, radio 999px, ancho completo, hover con
  elevación y active con escala).

### 3.3 Widget de prioridad eliminado (escritorio)

- Se eliminó el div `#siguiente-accion` ("Prioridad / Seguimiento (N) / En espera (N) / Ver")
  del rail lateral de `public/desktop/gestion-lote.html`.
- Se eliminó `actualizarSiguienteAccion(conteo, total)` de `public/desktop/js/gestion-lote.js`
  y su llamada en `actualizarBarraSemaforo`. Ya no se muestra el indicador de prioridad en
  escritorio.

---

## 4. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| Historial contextual por solicitud (`/api/gestiones-maestro/:id/solicitudes/:solicitudId/historial`) | Sin cambios |
| Modales existentes de Campañas (WhatsApp, Gestionar, Ver gestión) | Sin cambios |
| Carrusel del semáforo móvil (orden fijo — ver `docs/fix-semaforo-movil-orden-fijo.md`) | Sin cambios |
| `crearModal` / `escaparParaHTML` / `formatearFechaHistorial` (compartidos) | Sin cambios |

---

## Verificación

- ✅ Endpoint verificado en producción: `GET /api/gestiones-maestro/53/historial` → 200 con 5
  gestiones (campaña "Recuperación").
- ✅ `node --check` en `public/desktop/js/gestion-lote.js` y `public/movil/js/gestion-lote.js`.
- ✅ Producción sirve el JS nuevo (presentes `abrirHistorialCampanaDesktop` y
  `mostrarBotonHistorialCampanaDesktop`; ausente `actualizarSiguienteAccion`).
- ⏳ Prueba visual: abrir el modal desde móvil y desde el rail desktop.

## Documentación relacionada

- `docs/README.md` — estructura del proyecto (§11.5 Gestión por Lotes, §12.6 Campañas v2).
- `docs/fix-semaforo-movil-orden-fijo.md` — orden fijo del semáforo móvil.
- `docs/feature-ux-comportamiento-campanas.md` — UX de progreso y recomendaciones.
- `README.md` — tabla de Features Recientes.
