# Feature: Filtros de fecha (Desde/Hasta) disponibles para todos los usuarios en Solicitudes Desktop

**Fecha:** Agosto 2026
**Ámbito:**
- Frontend: `public/desktop/solicitudes.html`, `public/desktop/js/solicitudes.js`
- Backend: `src/controllers/excel.controller.js`
**Estado:** Implementado

---

## Resumen

Los filtros de fecha **📅 Desde / 📅 Hasta** de la página de Solicitudes (desktop) ahora están
disponibles para **todos los usuarios** (antes solo para Líder+). El filtro **👤 Vendedor**
sigue siendo exclusivo de Líder+ (nivel ≥ 30), protegido tanto en la UI como en el servidor.

## Antes — 3 barreras que ocultaban las fechas

1. **HTML:** los inputs `fechaDesde`/`fechaHasta` vivían dentro de `#filtrosLider`, que nace
   con `display:none`.
2. **JS:** solo se mostraban con `mostrarFiltrosLider()` cuando `_nivelRol >= 30`; además al
   armar la URL de búsqueda solo se enviaban `fecha_desde`/`fecha_hasta` si `_esLider`.
3. **Backend:** `excel.controller.js` aplicaba los filtros de fecha **solo dentro del bloque
   `if (isLeader)`** en `listarSolicitudes` y `buscarSolicitudes` (restricción de seguridad
   del lado del servidor).

## Solución — por capas

### 1. HTML (`public/desktop/solicitudes.html`)

Los inputs de fecha se movieron de `#filtrosLider` a un nuevo contenedor
**`#filtrosFecha` siempre visible** (junto a los selects de Estado/Segmento en la toolbar).
`#filtrosLider` quedó únicamente con el filtro 👤 Vendedor (se sigue mostrando con
`mostrarFiltrosLider()` solo para Líder+).

```
toolbar
├── selects Estado / Segmento
├── #filtrosFecha   → 📅 Desde + 📅 Hasta      (TODOS los usuarios)
├── #filtrosLider   → 👤 Vendedor              (solo Líder+, display:none por defecto)
└── botón Limpiar
```

### 2. JS (`public/desktop/js/solicitudes.js`)

- `buscarEnServidor()` arma la URL con `fecha_desde`/`fecha_hasta` **siempre** (sin
  condicionar a `_esLider`). El vendedor `vendedor=` solo se agrega si `_esLider`.
- `restaurarFiltrosUI()` restaura los valores de fecha desde `sessionStorage`
  (`sol_fecha_desde`/`sol_fecha_hasta`) para **todos** los usuarios (antes solo se
  restauraban dentro de `mostrarFiltrosLider`, exclusivo de líderes).
- El auto-aplicar por `onchange` y el debounce de 400 ms del vendedor se mantienen.

### 3. Backend (`src/controllers/excel.controller.js`)

En `listarSolicitudes` y `buscarSolicitudes` (query principal **y** COUNT), los filtros
`fecha_desde`/`fecha_hasta` se aplican en el SQL **fuera del bloque `if (isLeader)`**.

| Filtro | ¿Todos los usuarios? | Notas |
|--------|----------------------|-------|
| `estado` / `segmento` | ✅ | Ya estaba así |
| `fecha_desde` / `fecha_hasta` | ✅ | **Nuevo:** se quitó el guard de rol |
| `vendedor` | ❌ Solo Líder+ | Se mantiene dentro de `if (isLeader)` (seguridad) |

Se conservan los comportamientos documentados en `informe-fix-filtros-fecha-solicitudes.md`:
clave de caché con todas las dimensiones de filtro y `fecha_hasta + ' 23:59:59'` para incluir
el último día del rango.

## Verificación

- ✅ `node --check public/desktop/js/solicitudes.js` y `node --check src/controllers/excel.controller.js`.
- ✅ Code-review aprobado.
- ⚠️ **Importante:** el cambio de backend requiere **reiniciar el servidor** para aplicarse
  en producción.

## Documentación relacionada

- `docs/informe-fix-filtros-fecha-solicitudes.md` — fix previo (caché + límite de `fecha_hasta`).
- `docs/feature-header-filtros-solicitudes-desktop.md` — toolbar única con auto-aplicar.
- `docs/feature-filtros-movil-solicitudes.md` — versión móvil (las fechas colapsables ya
  estaban disponibles para todos en móvil).
