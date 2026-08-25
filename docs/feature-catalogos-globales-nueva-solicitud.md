# Feature: Catálogos globales en Nueva Solicitud — estados y segmentos de toda la aplicación

**Fecha:** Agosto 2026
**Ámbito:** `src/services/catalog.service.js` (backend únicamente; frontend sin cambios)
**Problema:** Al crear una **Nueva Solicitud** (móvil o escritorio), los listados de
**Estado** y **Segmento** se llenaban **solo con los valores del usuario autenticado**.
El "fallback inteligente" consultaba primero `SELECT DISTINCT ... WHERE usuario_id = X` y
solo caía a valores globales si ese usuario no tenía ninguna solicitud. Como consecuencia,
un usuario con datos propios no veía los estados/segmentos que usaban el resto de equipos
y usuarios de la aplicación.

---

## 1. Resumen

| Antes | Ahora |
|-------|-------|
| 1. Valores del usuario autenticado (`usuario_id = X`) | 1. Valores **globales** (toda la aplicación, sin filtro de usuario) |
| 2. Si vacío → valores globales | 2. Si vacío → valores por defecto |
| 3. Si vacío → valores por defecto | |

El formulario **➕ Nueva Solicitud** ahora ofrece **todos** los estados y segmentos que
existen en la aplicación, vengan del usuario que vengan.

---

## 2. Cambios

### 2.1 `src/services/catalog.service.js`

- **`getEstados(usuarioId)`** y **`getSegmentos(usuarioId)`**: se eliminó la consulta
  filtrada por `usuario_id`. Ahora ambas ejecutan directamente:

  ```sql
  SELECT DISTINCT estado/segmento
  FROM solicitudes
  WHERE estado/segmento IS NOT NULL AND estado/segmento != ''
  ORDER BY estado/segmento
  ```

- Se conserva el **fallback a valores por defecto** si la base está vacía:
  - Estados: `ACTIVADA`, `PENDIENTE`, `RECHAZADA`, `DEVUELTA`, `SIN ESTADO`
  - Segmentos: `GENERAL`
- Se conserva la **caché por usuario (TTL 60s)** con las claves existentes
  (`setEstadosUsuario` / `setSegmentosUsuario`). La invalidación que ya existe en todos los
  puntos de mutación (importación, creación, edición, eliminación) sigue funcionando sin
  tocar ningún otro archivo.
- Las firmas `getEstados(usuarioId)` / `getSegmentos(usuarioId)` **no cambian**; el
  `usuarioId` se sigue usando solo para la clave de caché.
- Se actualizó el encabezado del archivo para reflejar la nueva lógica global.

### 2.2 Sin cambios en frontend

| Elemento | Estado |
|----------|--------|
| `public/desktop/js/solicitudes.js` (`abrirModalNuevaSolicitud`) | Sin cambios — sigue consumiendo `/api/catalogos/estados` y `/api/catalogos/segmentos` |
| `public/movil/js/solicitudes.js` (`abrirModalNuevaSolicitudMovil`) | Sin cambios — igual |
| Endpoints `/api/catalogos/*` (`src/routes/catalog.routes.js`) | Sin cambios — mismas rutas y firmas |

---

## 3. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| Filtros del listado de Solicitudes (`/api/excel/dashboard/estados` y `/api/excel/dashboard/segmentos`) | Sin cambios — siguen por usuario |
| Filtros del panel de administración (`/api/admin/solicitudes/filtros`) | Sin cambios — ya eran globales |
| Creación manual de solicitud (`crearSolicitudManual`) | Sin cambios |
| Valores por defecto (`DEFAULT_ESTADOS`, `DEFAULT_SEGMENTOS`) | Sin cambios — siguen exportados |

---

## 4. Comportamiento resultante

| Caso | Antes | Ahora |
|------|-------|-------|
| Usuario con solicitudes propias | Veía **solo sus** estados/segmentos | Ve **todos** los de la aplicación |
| Usuario sin solicitudes | Veía los globales (por fallback) | Ve los globales (igual) |
| Base de datos vacía | Veía los valores por defecto | Ve los valores por defecto (igual) |
| Tiempo de reflejo de un estado/segmento nuevo | Hasta 60s (caché por usuario) | Hasta 60s (caché por usuario) |

### Nota de caché

Los valores son globales pero se cachean con clave por usuario (TTL 60s). Al crear,
importar o editar una solicitud se invalida la caché del usuario actuante; el resto de
usuarios puede ver listas con hasta 60s de antigüedad, lo cual es aceptable para dropdowns.

---

## Verificación

- ✅ `node --check src/services/catalog.service.js` — sin errores de sintaxis.
- ✅ Único consumidor del servicio: `src/routes/catalog.routes.js` (mismas firmas, sin impacto).
- ✅ Revisión de código: sin código muerto, sin firmas rotas, defaults aún exportados.
- ⏳ Prueba manual: abrir ➕ Nueva Solicitud con un usuario que tenga pocas solicitudes y
  confirmar que el listado muestra estados/segmentos de toda la aplicación.

## Documentación relacionada

- `README.md` — secciones API Catalogos (§ API) y tabla de Features Recientes.
- `docs/README.md` — estructura del proyecto (§4) y tablas de caché (§6.4 y §18).
- `docs/feature-admin-solicitudes-globales.md` — catálogos globales en el panel de admin
  (los filtros admin ya eran globales desde antes).
