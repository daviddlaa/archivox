# 📐 Convención: CSS de Solicitudes — Propiedad de Archivos

**Fecha:** Agosto 2026  
**Módulo:** Solicitudes (Desktop + Móvil)  
**Archivos relacionados:** `docs/feature-tarjeta-solicitudes-escritorio.md`

---

## 1. Por qué existe esta convención

La página de solicitudes carga **2 CSS** en escritorio y **2** en móvil, con un archivo **compartido** entre ambos:

| Archivo | Rol | Dónde se carga |
|---------|-----|----------------|
| `/css/solicitudes.css` | **CSS COMPARTIDO** — estructura de tarjetas y layout "unificado" (`.solicitud-card`, `.card-fila-*`, `.card-badge`, `.cards-grid-unificado`, `.stats-grid-unificado`, `.filtros-unificado`, `.buscador-unificado`, `.acciones-unificado`, `.selection-bar`) | Desktop **y** Móvil |
| `/desktop/css/solicitudes.css` | **CSS SOLO ESCRITORIO** — panel lateral de detalle, modales, floating panel, `.card-fila-contacto`, overrides | Solo Desktop |
| `/movil/css/solicitudes-mobile.css` | **CSS SOLO MÓVIL** | Solo Móvil |

**Importante:** el orden de carga en el HTML es `desktop/solicitudes.css` → `css/solicitudes.css` (compartido **después**). Por eso, a igual especificidad, **el CSS compartido gana**.

⚠️ Esto ya causó un bug real (Ago 2026): un `::after` con ✓ en el CSS compartido aparecía en la tarjeta de escritorio y nadie lo notaba porque "no era su archivo".

---

## 2. Reglas de oro

1. **La estructura de la tarjeta vive SOLO en el CSS compartido.**
   `.solicitud-card`, `.card-fila-1..5`, `.card-badge`, `.card-checkbox` → `public/css/solicitudes.css`. Si necesitas estilos de tarjeta **solo para tu plataforma**, no copies la regla: crea una **clase propia** (ej. `.card-fila-contacto`) o un override **con mayor especificidad** (`body .solicitud-card { ... }`).

2. **Nunca dupliques la misma regla en dos archivos.** Si una regla queda "tapada" por el compartido (misma especificidad, carga posterior), es código muerto — quítala.

3. **Los overrides de plataforma deben ganar por especificidad, no por `!important` ni por orden.**
   Ejemplo correcto (escritorio gana al compartido aunque se cargue antes):
   ```css
   /* compartido: .solicitud-card { cursor: default } → (0,1,0) */
   body .solicitud-card { cursor: pointer; }   /* (0,1,1) → gana */
   ```

4. **Cambios en el CSS compartido → probar en Desktop Y Móvil.** Es el único archivo que acopla las dos plataformas.

5. **Si tienes dos ramas/líneas de desarrollo (móvil y escritorio) en paralelo:**
   - **Solo una línea toca `public/css/solicitudes.css` a la vez.**
   - Si tu línea necesita algo de tarjeta, hazlo en tu CSS de plataforma con clase propia hasta fusionar.
   - Fusiones cortas y frecuentes para que el compartido no diverja.

---

## 3. ¿Dónde va cada regla?

| ¿Qué quieres estilar? | Archivo |
|-----------------------|---------|
| Estructura de la tarjeta (filas, badges, checkbox, grid) | `public/css/solicitudes.css` |
| Detalle que solo existe en escritorio (panel lateral, modales desktop, contactos de la tarjeta) | `public/desktop/css/solicitudes.css` |
| Detalle que solo existe en móvil | `public/movil/css/solicitudes-mobile.css` |
| Override de una regla compartida para tu plataforma | Tu CSS de plataforma, **con especificidad mayor** |

---

## 4. Limpieza ejecutada (Ago 2026)

Se eliminaron del CSS de escritorio las secciones del **layout antiguo sin uso** (verificado con grep que ninguna clase se usa en `public/desktop/solicitudes.html` ni `public/desktop/js/solicitudes.js`):

- Vista de **tabla** antigua (`.table-container`, `.cell-combinado`, `.cell-actions`, `.badge-estado.pendiente/…`, `.table-empty`)
- Tarjeta vieja (`.cards-container`, `.solicitud-card` base duplicada, `.card-fila-1 .card-checkbox*`, `.card-id`, `.badge-segmento`, `.cliente-*`, `.card-action*`, `.no-data`)
- Layout antiguo de página (`.header-actions`, `.btn-principal/.btn-secundario`, `.stats-grid`, `.stat-card` ×2, `.filter-*`, `.search-row`, `.main-content-grid`, `.resumen-*`, `.acciones-fila`, `.info-panel`, `.quick-actions`) y sus reglas responsive

**Conservado a propósito:** `.info-label`/`.info-value` genéricos usados por modales y las reglas scoped del panel de edición (`#editar-solicitud-modal-overlay .editar-info-item .info-label`).

El archivo pasó de ~2340 a ~2189 líneas sin cambios visuales (verificado: llaves balanceadas 307/307 y clases eliminadas sin uso en HTML/JS).
