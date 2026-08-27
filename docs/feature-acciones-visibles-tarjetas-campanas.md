# Feature: Acciones visibles en tarjetas de campañas (escritorio)

> **Estado:** ✅ Implementada
> **Fecha:** 27/08/2026
> **Ámbito:** Escritorio — `public/desktop/js/gestion-lote.js`, `public/css/gestion-lote.css`

---

## 1. Contexto

En las tarjetas de campañas (gestión por lote), las acciones secundarias — Historial, No aplica y Quitar de campaña — estaban escondidas dentro de un menú dropdown `⋯`. Para acceder a ellas el usuario tenía que hacer clic en el botón de tres puntos, lo cual las hacía poco descubiertas y de uso poco frecuente a pesar de ser funciones importantes del flujo de trabajo diario.

## 2. Cambio

Las 3 acciones se movieron del dropdown a **botones visibles directamente** en la barra de acciones de cada tarjeta, con un diseño vertical (icono arriba + etiqueta abajo) usando la nueva clase CSS `.sol-accion-icon-btn`.

### Antes
```
[📋 Seguimiento] [💬 Directo] [⋯]  ← dropdown con Historial, No aplica, Quitar
```

### Después
```
[📋 Seguimiento] [💬 Directo] [📋 Historial] [👎 No aplica] [❌ Quitar] [⏰]*

* El botón ⏰ (recordatorio) solo aparece si la solicitud tiene recordatorio activo.
```

## 3. Detalle técnico

### CSS (`public/css/gestion-lote.css`)

Nueva clase `.sol-accion-icon-btn`:
- `display: inline-flex; flex-direction: column; align-items: center`
- Icono de 16px arriba, label de 10px abajo
- `min-width: 44px` para consistencia táctil
- Variantes de color:
  - `.btn-quitar-solicitud` → rojo (`#fef2f2` fondo, `#991b1b` texto)
  - `.btn-no-aplica` → ámbar (`#fffbeb` fondo, `#92400e` texto)
  - `.btn-no-aplica.activo` → rojo cuando ya está marcado como no aplica
  - Default → gris claro (`#f8fafc` fondo, `#64748b` texto)

### JS (`public/desktop/js/gestion-lote.js`)

**En `renderizarSolicitudes()` (tarjetas activas):**
- Los 3 botones se renderizan como `<button class="sol-accion-icon-btn">` con `<span class="sol-accion-icon">` para el emoji
- El menú `⋯` ahora solo se muestra si `sol.recordatorio_id` existe, y contiene únicamente "Ver recordatorio"
- Se preservan los `onclick` existentes (`verHistorial`, `confirmarMarcarNoAplicaCredito`, `confirmarQuitarSolicitud`)

**En `renderizarTarjetaCompletada()` (tarjetas completadas):**
- Historial y Quitar también usan el nuevo estilo `.sol-accion-icon-btn`

## 4. Archivos modificados

| Archivo | Cambio |
|---|---|
| `public/css/gestion-lote.css` | Nueva clase `.sol-accion-icon-btn` + variantes `.btn-quitar-solicitud`, `.btn-no-aplica`, `.btn-no-aplica.activo` |
| `public/desktop/js/gestion-lote.js` | Botones movidos del dropdown a visibles en `renderizarSolicitudes()` y `renderizarTarjetaCompletada()` |

## 5. Compatibilidad

- **Mobile no afectado:** la versión móvil tiene su propio JS (`public/movil/js/gestion-lote.js`) con acciones diferentes
- **Dropdown `⋯` preservado:** sigue funcionando para Recordatorio (condicional), con la misma lógica `toggleSolMenu` / `closeSolMenus`
- **IDs y funciones intactos:** `verHistorial()`, `confirmarMarcarNoAplicaCredito()`, `confirmarQuitarSolicitud()` se llaman igual
- **CSS compartido:** la clase `.sol-accion-icon-btn` se agregó en `gestion-lote.css` (compartido), pero solo se usa en el HTML generado por el JS de desktop
