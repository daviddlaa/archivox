# Feature: Reactivación sin compra de solicitudes liberadas (>6 meses sin relación)

**Fecha:** Agosto 2026
**Ámbito:** `src/services/liberacion.service.js`, `src/routes/liberacion.routes.js`,
`src/services/liberacionScheduler.js`, `app.js`,
`public/desktop/solicitudes.html`, `public/desktop/js/solicitudes.js`,
`public/movil/solicitudes.html`, `public/movil/js/solicitudes.js`,
`public/css/solicitudes.css`
**Solicitud:** Cuando una solicitud lleva en `APROBADA PARA LIBERACIÓN` más de 6 meses (desde
`fecha_solicitud`) y ya no tiene una relación activa con el usuario, si el cliente compra la
venta NO se refleja. Se necesita avisar al usuario (banner + notificación in-app), listarlas y
permitir reactivarlas creando una campaña (estado → `ACTIVADA`) sin exigir una compra.

---

## 1. Resumen

Se creó un banner de alerta en la página de Solicitudes (desktop y móvil) que cuenta las
solicitudes de liberación caducadas; un listado modal con selección múltiple; y dos acciones:
**"Activar sin compra"** (cambia el estado a `ACTIVADA`) y **"Crear campaña y activar"**
(crea una `gestiones_maestro` con esas solicitudes y las activa). Un scheduler periódico (cada
6h) genera una notificación in-app (dedup 24h por usuario) con deep link `?liberacion=1`.

---

## 2. Criterio de la lista

Una solicitud entra en la alerta si **todas** las condiciones se cumplen:

1. `estado = 'APROBADA PARA LIBERACIÓN'`.
2. `fecha_solicitud` es de hace **más de 6 meses** (corte = hoy − 6 meses, se calcula en JS como
   `YYYY-MM-DD` y se compara lexicográficamente).
3. **Sin relación activa**: `NOT EXISTS` una relación en `relaciones` con el mismo `usuario_id`
   y `identificacion = cedula` en estado `ALTA` (BAJA o inexistente = sin relación).
4. **Sigue aplicando para crédito**: `COALESCE(no_aplica_credito, 1) = 1`. Las solicitudes
   separadas con la bandera 👎 **"ya no aplica"** (`no_aplica_credito = 0`) se **excluyen**
   del conteo, del listado y de las alertas del scheduler.

Toda la lógica de filtrado vive en `buildWhereLiberacion()` de `src/services/liberacion.service.js`;
los tres consumidores (contar, listar, resumen por usuario) comparten el mismo WHERE.

---

## 3. Backend

### 3.1 Endpoints (`/api/liberacion`, registrados en `app.js`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/liberacion/contar` | `requiresAuth` | `{ total }` de solicitudes que cumplen el criterio (banner) |
| `GET` | `/api/liberacion` | `requiresAuth` | Listado paginado (`?limite=` máx 500, `?offset=`, `?q=` búsqueda por id/cédula/nombre/celular) |
| `POST` | `/api/liberacion/activar` | `requiresAuth` | `{ ids, crear_campana, nombre_campana }` → activa en lote; con `crear_campana:true` crea la campaña y devuelve `campana_id` |

### 3.2 Reglas de activación

- Solo activa solicitudes que cumplen el criterio del punto 2 (incluida la bandera
  `no_aplica_credito = 1`): una fila ya separada se ignora con `"No hay solicitudes válidas"`.
- Con campaña: crea `gestiones_maestro` (solo columnas presentes en ambos motores), inserta el
  puente `gestiones_maestro_solicitudes` en `sin_clasificar`, vincula `solicitudes.campana_id`
  y activa cada solicitud (estado → `ACTIVADA` + fila en `historial_actualizaciones`).
- Invalida caché: `invalidateDashboard`, `invalidateCatalogosUsuario`, `invalidateAllCampanas`.

### 3.3 Scheduler `src/services/liberacionScheduler.js`

- Se arranca al final de `app.js` (`iniciarLiberacionScheduler()`), intervalo **6h**.
- Dedup: solo crea la notificación si no existe otra con el título fijo
  `'⚠️ Solicitudes liberadas por reactivar'` en las últimas 24h para ese usuario.
- `accion_url: '/solicitudes?liberacion=1'`, tipo `warning`, prioridad `alta`, emite eventos SSE
  `notification.created` y `count.updated`.
- Reintenta el primer pase si la tabla de notificaciones aún no existe (Postgres crea el esquema
  en background).

---

## 4. Frontend

### 4.1 Escritorio (`public/desktop/`)

- **Banner** `#liberacion-banner` sobre el toolbar (hidden por CSS, se muestra con `.visible`
  cuando `total > 0`): "Tienes N solicitudes en APROBADA PARA LIBERACIÓN con más de 6 meses…",
  con botones **📋 Ver listado**, **🚀 Crear campaña de activación** y **✕** para ocultar.
- **Listado modal** vía `Modal.abrir(html, { ancho: 'wide' })`: filas con checkbox, nombre,
  cédula, celular, fecha y segmento; "✓ Seleccionar todo"; acciones **✅ Activar sin compra** y
  **🚀 Crear campaña y activar** (pide nombre en un segundo modal, redirige a
  `/gestion-lote?id=<campana_id>`).
- Deep link `?liberacion=1` en la URL abre el listado al cargar.
- Escape de datos con el helper local `panelEscapeHtml`.

### 4.2 Móvil (`public/movil/`)

- Mismo banner (sin botón ✕) y listado modal, pero con la API propia de la página:
  `crearModalMovil(contenido)` / `cerrarModal()`. No usa `Modal` de `modal.js`.
- Redirige a `/m/gestion-lote?id=<campana_id>`.
- Escape con `escaparParaHTMLMovil`.

### 4.3 CSS

Estilos en el compartido `public/css/solicitudes.css` (`.liberacion-*`), cargado por ambas
plataformas, con media query para móvil. Respetar la convención
`docs/convencion-css-solicitudes.md`: overrides de plataforma por especificidad.

---

## 5. Pruebas (SQLite local, `DATABASE_URL= NODE_ENV=development`)

- `GET /api/liberacion/contar` → `74` para el usuario 1 (sin filas separadas localmente).
- Al marcar una fila con `no_aplica_credito = 0` → el conteo baja a `73`, la fila desaparece del
  listado, y `POST /api/liberacion/activar` con su id devuelve `"No hay solicitudes válidas"`.
- Flujo feliz: activar una fila válida sin campaña cambia su estado a `ACTIVADA` (revertido tras
  la prueba).
- Con `NODE_ENV=production` (cargado por `.env`) la cookie de sesión no se emite por HTTP:
  **siempre** probar con `NODE_ENV=development`.