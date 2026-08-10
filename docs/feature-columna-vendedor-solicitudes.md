# Feature: Columna "vendedor" en solicitudes (movida desde gestiones)

**Fecha:** Julio 2026
**Versión:** Archivox v3.0
**Estado:** Implementado y en producción

---

## Descripción

El campo `vendedor` fue **movido de la tabla `gestiones` a la tabla `solicitudes`**. La razón: `vendedor` es un atributo de la solicitud (la oportunidad), no de cada gestión (acción individual). Esto evita redundancia y inconsistencias (un vendedor diferente por gestión de la misma solicitud).

### Historial de cambios

| Migración | Tabla | Columna | Estado |
|-----------|-------|---------|--------|
| 005 | `gestiones` | `vendedor TEXT` | ❌ Eliminada |
| 006 | `gestiones_relaciones` | `vendedor TEXT` | ❌ Eliminada |
| **007** | **`solicitudes`** | **`vendedor TEXT`** | ✅ Activa |
| 008 | `gestiones` | `vendedor` | ✅ Ejecutada (DROP COLUMN) |
| 008 | `gestiones_relaciones` | `vendedor` | ✅ Ejecutada (DROP COLUMN) |

---

## Migraciones ejecutadas en producción

```bash
# Migración 007: Agregar vendedor a solicitudes
node migrations/007_add_vendedor_to_solicitudes.js

# Migración 008: Eliminar vendedor de gestiones y gestiones_relaciones
node migrations/008_remove_vendedor_from_gestiones.js
```

Ambas migraciones son **idempotentes**: no fallan si la columna ya existe/fue eliminada.

---

## Seguridad

| Rol | Nivel | ¿Puede guardar vendedor? |
|-----|-------|--------------------------|
| SuperAdmin | 100 | Sí |
| Admin | 50 | Sí |
| Líder | 30 | Sí |
| Agente | 20 | No (se fuerza a NULL) |
| User | 10 | No (se fuerza a NULL) |

La validación se realiza en el **backend** (servidor), no en el frontend. Incluso si un Agente intenta inyectar el campo vendedor vía request HTTP, el servidor lo descarta y guarda `NULL`.

El mapeo de roles es **case-insensitive** (`toLowerCase()`) para evitar que un SuperAdmin con rol `"SuperAdmin"` en la BD quede bloqueado.

```javascript
// En cada controlador que inserta/actualiza solicitudes:
const rolNormalizado = (req.session.usuario?.rol || '').toLowerCase();
const nivelMap = { superadmin: 100, admin: 50, lider: 30, agente: 20, user: 10 };
const nivel = nivelMap[rolNormalizado] || 0;
const vendedorValue = nivel >= 30 ? (vendedor || null) : null;
```

---

## Archivos modificados (Sesión de limpieza)

### Backend — Controladores (gestiones: limpieza)

| Archivo | Función | Cambio |
|---------|---------|--------|
| `src/controllers/excel.controller.js` | `crearGestion` | ❌ Eliminado `vendedor` del INSERT, role validation, body destructuring |
| `src/controllers/excel.controller.js` | `actualizarGestion` | ❌ Eliminado `vendedor` del UPDATE, role validation, body destructuring |
| `src/controllers/excel.controller.js` | `getGestionesUltimas` | ❌ Eliminado `g.vendedor` del SELECT, eliminado `vendedor` del objeto respuesta |
| `src/controllers/excel.controller.js` | `getTodasGestiones` | ✅ Cambiado `g.vendedor` → `s.vendedor` (via JOIN con solicitudes) |
| `src/controllers/gestionesMaestro.controller.js` | `createGestion` | ❌ Eliminado `vendedor` del INSERT, role validation, body destructuring |
| `src/controllers/relacionesGestion.controller.js` | `crearGestion` | ❌ Eliminado `vendedor` del INSERT, role validation, body destructuring |
| `src/controllers/relacionesGestion.controller.js` | `getGestionesUltimas` | ❌ Eliminado `g.vendedor` del SELECT, eliminado `vendedor` del objeto respuesta |

### Backend — Controladores (solicitudes: funcional)

| Archivo | Función | Cambio |
|---------|---------|--------|
| `src/controllers/excel.controller.js` | `crearSolicitudManual` | ✅ Recibe `vendedor` del body, validación de rol, incluido en INSERT PG y SQLite |
| `src/controllers/excel.controller.js` | `actualizarSolicitudEditar` | ✅ Recibe `vendedor` del body, validación de rol, SET dinámico |

### Backend — Servicios

| Archivo | Función | Cambio |
|---------|---------|--------|
| `src/services/excel.service.js` | `uploadExcel` | ✅ Mapeo de columna Excel `VENDEDOR` → `solicitudes.vendedor` en UPDATE e INSERT (PG y SQLite) |

### Backend — Migraciones

| Archivo | Tabla | Columna | Estado |
|---------|-------|---------|--------|
| `migrations/005_add_vendedor_to_gestiones.js` | `gestiones` | `vendedor TEXT` | ❌ Obsoleta |
| `migrations/006_add_vendedor_to_gestiones_relaciones.js` | `gestiones_relaciones` | `vendedor TEXT` | ❌ Obsoleta |
| `migrations/007_add_vendedor_to_solicitudes.js` | `solicitudes` | `vendedor TEXT` | ✅ Ejecutada |
| `migrations/008_remove_vendedor_from_gestiones.js` | `gestiones`, `gestiones_relaciones` | DROP `vendedor` | ✅ Ejecutada |

### Frontend — Formularios (solicitudes: creación)

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | ✅ Input "Vendedor" en modal "Nueva Solicitud", visible solo para Líder+. Incluido en POST body |
| `public/movil/js/solicitudes.js` | ✅ Mismo cambio para móvil |

### Frontend — Formularios (gestiones: limpieza)

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | ❌ Eliminado input "Vendedor" del modal de creación de gestión |
| `public/movil/js/solicitudes.js` | ❌ Eliminado input "Vendedor" del modal de creación de gestión |
| `public/desktop/js/gestion-lote.js` | ❌ Eliminado input "Vendedor", role check, y lógica de guardado |
| `public/movil/js/gestion-lote.js` | ❌ Eliminado input "Vendedor", role check, y lógica de guardado |

### Frontend — Visualización

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | ❌ Eliminado vendedor del historial de gestiones (detalle solicitud) |
| `public/movil/js/solicitudes.js` | ❌ Eliminado vendedor del historial de gestiones (detalle solicitud) |
| `public/desktop/js/gestiones.js` | ✅ Mantiene `g.vendedor` — funciona via `getTodasGestiones` JOIN con `solicitudes.s.vendedor` |
| `public/movil/js/gestiones.js` | ✅ Mantiene `g.vendedor` — funciona via JOIN |
| `public/desktop/js/gestion-lote.js` | ✅ Mantiene `g.vendedor` en timeline historial — funciona via JOIN |
| `public/movil/js/gestion-lote.js` | ✅ Mantiene `g.vendedor` en timeline historial — funciona via JOIN |

---

## API

### Solicitudes (con vendedor)

| Operación | Endpoint | Método | vendedor |
|-----------|----------|--------|----------|
| Crear solicitud manual | `/api/excel/solicitudes` | POST | ✅ Opcional |
| Editar solicitud | `/api/excel/solicitudes/:id` | PUT | ✅ Opcional |
| Importar Excel | `/api/excel/upload` | POST | ✅ Columna `VENDEDOR` |

### Gestiones (sin vendedor)

| Operación | Endpoint | Método | vendedor |
|-----------|----------|--------|----------|
| Crear gestión | `/api/excel/gestiones` | POST | ❌ No aplica |
| Actualizar gestión | `/api/excel/gestiones/:id` | PUT | ❌ No aplica |
| Listar todas las gestiones | `/api/excel/gestiones/todas` | GET | ✅ Retorna `s.vendedor` via JOIN |
| Últimas gestiones (batch) | `/api/excel/gestiones/ultimas` | GET | ❌ No incluye vendedor |
| Crear gestión (campaña) | `/api/gestiones-maestro` | POST | ❌ No aplica |
| Crear gestión de relación | `/api/relaciones/gestiones` | POST | ❌ No aplica |

---

## Frontend — Comportamiento

### Creación de solicitud ("Nueva Solicitud")

1. El campo "Vendedor" aparece en la sección "Más Información (Opcional)" del modal
2. **Solo se muestra** si el usuario tiene rol Líder, Admin o SuperAdmin
3. Al enviar, se incluye en el body `{ vendedor: "valor" }` y el backend valida el rol

### Visualización de vendedor

- **Tabla de gestiones** (`gestiones.js`): Muestra `s.vendedor` via JOIN con solicitudes
- **Cards de gestiones**: Muestra vendedor si existe
- **Exportación a Excel**: Incluye columna "Vendedor"
- **Historial de gestiones en solicitudes**: Ya NO muestra vendedor (era del campo eliminado de gestiones)

### Valores null

Los registros históricos (anteriores a la migración 007) tienen `vendedor = NULL`. En la UI se muestra como `-` o se omite el campo.

---

## Badge "Vendedor" en tarjetas de solicitudes

**Agregado:** Julio 2026

### Descripción

Se agregó un badge/etiqueta que muestra el vendedor asociado a cada solicitud en el listado de tarjetas (Desktop y Móvil). El badge **solo es visible para usuarios con rol Líder, Admin o SuperAdmin** (nivel >= 30).

### Comportamiento

- **Ubicación**: FILA 5 de la tarjeta, junto a Producto y Fecha
- **Estilo**: Badge discreto con fondo `#e0e7ff` y texto `#3730a3` (indigo suave)
- **Visibilidad**: Solo aparece si `_esLider === true && item.vendedor` no está vacío
- **Valores null**: Si `vendedor` es null/undefined, el badge no se muestra (ni siquiera "Sin vendedor")

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | `renderizarCards()` agrega badge vendedor en FILA 5 |
| `public/movil/js/solicitudes.js` | Mismo cambio para móvil |
| `public/css/solicitudes.css` | Clase `.vendedor-badge` |
| `public/movil/css/solicitudes-mobile.css` | Clase `.vendedor-badge` para móvil |

### CSS

```css
.card-fila-5 .vendedor-badge {
    background: #e0e7ff;
    color: #3730a3;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
}
```

---

## Filtros de Fecha y Vendedor (Solo Líder+)

**Agregado:** Julio 2026

### Descripción

Se agregaron dos filtros adicionales en el listado de solicitudes para usuarios con rol Líder+:
1. **Rango de fechas** (desde/hasta) para filtrar por `fecha_solicitud`
2. **Vendedor** (búsqueda parcial) para filtrar por el campo `vendedor`

### Backend

#### Endpoint modificado: `listarSolicitudes` y `buscarSolicitudes`

**Nuevos parámetros query:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `fecha_desde` | string | Fecha mínima (formato YYYY-MM-DD) |
| `fecha_hasta` | string | Fecha máxima (formato YYYY-MM-DD) |
| `vendedor` | string | Búsqueda parcial (LIKE %texto%) |

**Role validation:**

```javascript
const rolNormalizado = (req.session.usuario?.rol || '').toLowerCase();
const nivelMap = { superadmin: 100, admin: 50, lider: 30, agente: 20, user: 10 };
const nivel = nivelMap[rolNormalizado] || 0;
const isLeader = nivel >= 30;

// Solo aplicar filtros si isLeader
if (isLeader) {
    if (fecha_desde) { sql += ' AND s.fecha_solicitud >= $' + paramIndex++; params.push(fecha_desde); }
    if (fecha_hasta) { sql += ' AND s.fecha_solicitud <= $' + paramIndex++; params.push(fecha_hasta); }
    if (vendedor && vendedor.trim() !== '') {
        sql += ' AND LOWER(s.vendedor) LIKE LOWER($' + paramIndex++ + ')';
        params.push('%' + vendedor.trim() + '%');
    }
}
```

**Seguridad:** Si un Agente intenta enviar `fecha_desde`, `fecha_hasta` o `vendedor` por URL, el backend los **ignora completamente** (no los aplica a la consulta).

#### Nuevo endpoint: `getVendedoresUnicos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/excel/solicitudes/vendedores` | Lista de vendedores únicos del usuario |

- Solo accesible para Lider+ (nivel >= 30)
- Retorna array de strings: `["Juan", "María", "Pedro"]`
- Útil para autocompletado/datalist en el frontend

### Frontend Desktop

#### HTML (`public/desktop/solicitudes.html`)

Se agregó una sección `#filtrosLider` dentro de `.filtros-unificado`, oculta por defecto:

```html
<div id="filtrosLider" class="filtros-row" style="display:none;margin-top:8px;">
    <div class="filtro-grupo">
        <span class="filtro-label">📅 Desde</span>
        <input type="date" id="fechaDesde" class="filtro-input-date">
    </div>
    <div class="filtro-grupo">
        <span class="filtro-label">📅 Hasta</span>
        <input type="date" id="fechaHasta" class="filtro-input-date">
    </div>
    <div class="filtro-grupo">
        <span class="filtro-label">👤 Vendedor</span>
        <input type="text" id="filtroVendedor" placeholder="Buscar vendedor..." class="filtro-input-text" list="vendedoresList">
        <datalist id="vendedoresList"></datalist>
    </div>
    <div class="filtro-grupo" style="align-self:flex-end;">
        <button class="filtro-btn" onclick="aplicarFiltrosLider()" style="background:#2563eb;color:white;">Aplicar</button>
        <button class="filtro-btn" onclick="limpiarFiltrosLider()" style="background:#f3f4f6;">Limpiar</button>
    </div>
</div>
```

#### JavaScript (`public/desktop/js/solicitudes.js`)

**Variables globales:**

```javascript
let fechaDesdeActual = sessionStorage.getItem('sol_fecha_desde') || '';
let fechaHastaActual = sessionStorage.getItem('sol_fecha_hasta') || '';
let vendedorActual = sessionStorage.getItem('sol_vendedor') || '';
```

**Funciones:**

| Función | Descripción |
|---------|-------------|
| `mostrarFiltrosLider()` | Muestra la sección de filtros y restaura valores de sessionStorage |
| `cargarVendedores()` | Carga lista de vendedores para el datalist |
| `aplicarFiltrosLider()` | Guarda valores en sessionStorage y ejecuta búsqueda |
| `limpiarFiltrosLider()` | Limpia inputs, sessionStorage y ejecuta búsqueda |

**Init:**

```javascript
// En init(), después de cargar sesión:
if (_esLider) mostrarFiltrosLider();
```

**Búsqueda:**

```javascript
// En buscarEnServidor():
if (_esLider) {
    if (fechaDesdeActual) url += `&fecha_desde=${encodeURIComponent(fechaDesdeActual)}`;
    if (fechaHastaActual) url += `&fecha_hasta=${encodeURIComponent(fechaHastaActual)}`;
    if (vendedorActual) url += `&vendedor=${encodeURIComponent(vendedorActual)}`;
}
```

### Frontend Móvil

Misma lógica que Desktop, adaptada a IDs móviles (`fechaDesdeMovil`, etc.) y layout responsive.

**Archivos:**
- `public/movil/solicitudes.html` - HTML con filtros
- `public/movil/js/solicitudes.js` - Lógica JavaScript
- `public/movil/css/solicitudes-mobile.css` - Estilos responsive

### CSS

**Desktop** (`public/css/solicitudes.css`):

```css
.filtros-unificado .filtro-input-date,
.filtros-unificado .filtro-input-text {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    color: #374151;
    background: white;
    outline: none;
    transition: border-color 0.2s;
}
.filtros-unificado .filtro-input-date:focus,
.filtros-unificado .filtro-input-text:focus {
    border-color: #2563eb;
}
```

**Móvil** (`public/movil/css/solicitudes-mobile.css`):

```css
.filtros-unificado .filtro-input-date,
.filtros-unificado .filtro-input-text {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    color: #374151;
    background: white;
    outline: none;
    width: 100%;
}
.filtros-unificado .filtro-input-date:focus,
.filtros-unificado .filtro-input-text:focus {
    border-color: #6366f1;
}
```

### Persistencia

Los filtros se persisten en `sessionStorage`:

| Clave | Valor |
|-------|-------|
| `sol_fecha_desde` | Fecha desde (YYYY-MM-DD) |
| `sol_fecha_hasta` | Fecha hasta (YYYY-MM-DD) |
| `sol_vendedor` | Texto de búsqueda vendedor |

Al recargar la página, los filtros se restauran automáticamente.

### Pruebas de validación

| Caso | Resultado esperado |
|------|--------------------|
| Login como Líder → filtros visibles | Aparecen fecha y vendedor en Desktop y Móvil |
| Login como Agente → filtros ocultos | NO aparecen los filtros adicionales |
| Líder selecciona rango de fechas | Listado se filtra por `fecha_solicitud` |
| Líder escribe "Juan" en vendedor | Muestra solicitudes donde vendedor contiene "Juan" |
| Líder combina segmento + estado + fecha + vendedor | Todos los filtros se aplican |
| Agente envía `?fecha_desde=2026-01-01` por URL | Backend ignora el parámetro |
| Datalist se carga con vendedores existentes | Al escribir sugiere opciones |
| Filtros persisten al recargar | sessionStorage mantiene valores |
| Botón "Limpiar" resetea todo | Inputs vacíos, búsqueda sin filtros Lider |

---

## Resumen de archivos modificados (Sesión completa)

### Backend

| Archivo | Cambios |
|---------|---------|
| `src/controllers/excel.controller.js` | `listarSolicitudes`, `buscarSolicitudes`: filtros fecha/vendedor. Nuevo: `getVendedoresUnicos` |
| `src/routes/excel.routes.js` | Nueva ruta `/solicitudes/vendedores` |

### Frontend Desktop

| Archivo | Cambios |
|---------|---------|
| `public/desktop/solicitudes.html` | Sección `#filtrosLider` con inputs date + vendedor |
| `public/desktop/js/solicitudes.js` | Variables, funciones de filtro, init, buscarEnServidor |
| `public/css/solicitudes.css` | Estilos `.filtro-input-date`, `.filtro-input-text`, `.vendedor-badge` |

### Frontend Móvil

| Archivo | Cambios |
|---------|---------|
| `public/movil/solicitudes.html` | Sección `#filtrosLider` responsive |
| `public/movil/js/solicitudes.js` | Variables, funciones de filtro, init, buscarEnServidor |
| `public/movil/css/solicitudes-mobile.css` | Estilos inputs filtros + `.vendedor-badge` |

---

## Badge "Campaña" en tarjetas de solicitudes

**Agregado:** Julio 2026

### Descripción

Se agregó un badge/etiqueta que muestra el nombre de la campaña asociada a cada solicitud en el listado de tarjetas (Desktop y Móvil). El badge es **visible para todos los usuarios** (agentes y líderes) porque es información de contexto.

### Migración

Se creó la columna `campana_id` en la tabla `solicitudes` para establecer una relación directa con `gestiones_maestro`.

```bash
# Migración 009: Agregar campana_id a solicitudes
node migrations/009_add_campana_id_to_solicitudes.js
```

**Estructura de la migración:**

```sql
ALTER TABLE solicitudes ADD COLUMN campana_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_solicitudes_campana ON solicitudes(campana_id);
```

### Modelo de datos

| Tabla | Columna | Tipo | Referencia |
|-------|---------|------|------------|
| `solicitudes` | `campana_id` | INTEGER | `gestiones_maestro.id` (opcional) |
| `gestiones_maestro` | `id` | SERIAL | PK |
| `gestiones_maestro` | `solicitudes_ids` | TEXT | JSON array de IDs (legado) |

**Notas:**
- La columna `campana_id` se establece automáticamente al agregar solicitudes a una campaña
- Se limpia (`NULL`) al quitar una solicitud de una campaña
- `gestiones_maestro.solicitudes_ids` se mantiene por compatibilidad, pero `campana_id` es la fuente de verdad para consultas

### Backend

#### `listarSolicitudes` y `buscarSolicitudes` (`src/controllers/excel.controller.js`)

**Cambio en la consulta SQL:**

```sql
SELECT s.*,
       g.tipo_gestion as ultima_gestion_tipo,
       g.observacion as ultima_gestion_obs,
       g.fecha_gestion as ultima_gestion_fecha,
       gm.nombre as nombre_campana
FROM solicitudes s
LEFT JOIN LATERAL (
    SELECT g2.tipo_gestion, g2.observacion, g2.fecha_gestion
    FROM gestiones g2
    WHERE g2.solicitud_id = s.id_solicitud 
      AND g2.usuario_id = s.usuario_id
    ORDER BY g2.fecha_gestion DESC
    LIMIT 1
) g ON TRUE
LEFT JOIN gestiones_maestro gm ON s.campana_id = gm.id
WHERE s.usuario_id = $1
```

El campo `nombre_campana` se retorna en la respuesta (puede ser `null` si la solicitud no tiene campaña).

#### `agregarSolicitudesACampana` (`src/controllers/gestionesMaestro.controller.js`)

Al agregar solicitudes a una campaña, se actualiza `campana_id` en cada solicitud:

```javascript
// Actualizar campana_id en las solicitudes nuevas
for (var i = 0; i < nuevosIds.length; i++) {
    await pool.query(
        'UPDATE solicitudes SET campana_id = ? WHERE id_solicitud = ? AND (campana_id IS NULL OR campana_id != ?)',
        [id, nuevosIds[i], id]
    );
}
```

#### `quitarSolicitudDeCampana` (`src/controllers/gestionesMaestro.controller.js`)

Al quitar una solicitud de una campaña, se limpia `campana_id`:

```javascript
// Limpiar campana_id de la solicitud quitada
await pool.query(
    'UPDATE solicitudes SET campana_id = NULL WHERE id_solicitud = ? AND campana_id = ?',
    [solicitud_id, id]
);
```

### Frontend Desktop

**Archivo:** `public/desktop/js/solicitudes.js`

En la función `renderizarCards()`, FILA 5:

```javascript
// FILA 5: Producto + Fecha + Vendedor + Campaña
html += '  <div class="card-fila-5">';
html += '    <span class="card-tag">📦 <span>' + (item.producto || '—') + '</span></span>';
html += '    <span class="card-tag">📅 <span>' + (item.fecha_solicitud || '—') + '</span></span>';
if (_esLider && item.vendedor) {
    html += '    <span class="card-tag vendedor-badge">👤 <span>' + item.vendedor + '</span></span>';
}
if (item.nombre_campana) {
    html += '    <span class="card-tag campana-badge">📢 <span>' + item.nombre_campana + '</span></span>';
}
html += '  </div>';
```

### Frontend Móvil

**Archivo:** `public/movil/js/solicitudes.js`

Misma lógica que Desktop en la función `renderizarCards()`.

### CSS

**Desktop** (`public/css/solicitudes.css`):

```css
.card-fila-5 .campana-badge {
    background: #e3f2fd;
    color: #0d47a1;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
}
.card-fila-5 .campana-badge span {
    font-weight: 600;
}
```

**Móvil** (`public/movil/css/solicitudes-mobile.css`):

```css
.card-fila-5 .campana-badge {
    background: #e3f2fd;
    color: #0d47a1;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
}
.card-fila-5 .campana-badge span {
    font-weight: 700;
    color: #0d47a1;
}
```

### Comportamiento

- **Ubicación**: FILA 5 de la tarjeta, junto a Producto, Fecha y Vendedor
- **Estilo**: Badge con fondo azul claro (`#e3f2fd`) y texto azul oscuro (`#0d47a1`)
- **Visibilidad**: Aparece para todos los usuarios si `item.nombre_campana` no es null
- **Valores null**: Si la solicitud no tiene campaña, el badge no se muestra

### Pruebas de validación

| Caso | Resultado esperado |
|------|--------------------|
| Listar solicitudes | Campo `nombre_campana` llega en la respuesta (puede ser null) |
| Solicitud en campaña | Badge `📢 NombreCampaña` aparece en la tarjeta |
| Solicitud sin campaña | NO aparece badge de campaña |
| Desktop y Móvil | Badge se ve correctamente sin romper layout |
| Agente ve listado | Badge visible (es información de contexto) |
| Líder ve listado | Badge visible |
| Agregar solicitud a campaña | `campana_id` se actualiza en la solicitud |
| Quitar solicitud de campaña | `campana_id` se limpia a NULL |

### Índices

| Índice | Tabla | Columna | Propósito |
|--------|-------|---------|-----------|
| `idx_solicitudes_campana` | `solicitudes` | `campana_id` | Búsquedas por campaña |

---

## Resumen final de archivos modificados

### Backend

| Archivo | Cambios |
|---------|---------|
| `src/controllers/excel.controller.js` | `listarSolicitudes`, `buscarSolicitudes`: LEFT JOIN para `nombre_campana` + filtros fecha/vendedor. Nuevo: `getVendedoresUnicos` |
| `src/controllers/gestionesMaestro.controller.js` | `agregarSolicitudesACampana`: actualiza `campana_id`. `quitarSolicitudDeCampana`: limpia `campana_id` |
| `src/routes/excel.routes.js` | Nueva ruta `/solicitudes/vendedores` |
| `src/config/initDb.js` | Columna `campana_id` + índice en SQLite |
| `src/config/initDb.pg.js` | Columna `campana_id` + índice en PostgreSQL |
| `migrations/009_add_campana_id_to_solicitudes.js` | Nueva migración |

### Frontend Desktop

| Archivo | Cambios |
|---------|---------|
| `public/desktop/solicitudes.html` | Sección `#filtrosLider` con inputs date + vendedor |
| `public/desktop/js/solicitudes.js` | Badge campaña en FILA 5 + funciones de filtro Lider+ |
| `public/css/solicitudes.css` | Estilos `.filtro-input-date`, `.filtro-input-text`, `.vendedor-badge`, `.campana-badge` |

### Frontend Móvil

| Archivo | Cambios |
|---------|---------|
| `public/movil/solicitudes.html` | Sección `#filtrosLider` responsive |
| `public/movil/js/solicitudes.js` | Badge campaña en FILA 5 + funciones de filtro Lider+ |
| `public/movil/css/solicitudes-mobile.css` | Estilos inputs filtros + `.vendedor-badge` + `.campana-badge` |
