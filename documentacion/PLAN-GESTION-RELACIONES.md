# PLAN: Gestión y Acciones en Página Relaciones

> **Versión:** 1.0
> **Estado:** Pendiente de aprobación
> **Objetivo:** Agregar botones de llamada/WhatsApp a cada card de Relaciones y un sistema de gestión (seguimiento) similar al de solicitudes.

---

## 1. El problema

Actualmente la página Relaciones solo **muestra** datos. No permite:
- Hacer seguimiento (llamada, WhatsApp, etc.) a una relación
- Registrar observaciones
- Abrir WhatsApp directo con el cliente
- Llamar al cliente

Necesitamos exactamente lo mismo que ya existe en **Gestión por Lotes (Campañas)**, pero para las relaciones.

---

## 2. Análisis de opciones para la tabla de gestión

### Opción A: Reutilizar la tabla `gestiones` existente

Agregar una columna `relacion_id` (nullable) a la tabla `gestiones`:

```sql
ALTER TABLE gestiones ADD COLUMN relacion_id INTEGER REFERENCES relaciones(id);
```

**Pros:**
- Un solo repositorio de todas las gestiones del sistema
- El endpoint `POST /api/excel/gestiones` ya existe y funciona
- El modal de gestión se reutiliza tal cual
- El historial se puede consultar con el mismo endpoint `GET /api/excel/gestiones/:id`

**Contras:**
- La tabla mezcla gestiones de solicitudes con gestiones de relaciones
- Las consultas se complican (hay que filtrar por `solicitud_id` o `relacion_id`)

### Opción B: Nueva tabla `gestiones_relaciones`

```sql
CREATE TABLE gestiones_relaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relacion_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tipo_gestion TEXT NOT NULL,
    observacion TEXT,
    fecha_gestion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (relacion_id) REFERENCES relaciones(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
```

**Pros:**
- Separación limpia de dominios
- Consultas simples y rápidas
- Sin riesgo de romper la funcionalidad existente de solicitudes

**Contras:**
- Nuevo endpoint, nuevo controller, más código
- Hay que duplicar lógica de gestiones (guardar, listar, historial)

### ✅ Recomendación: Opción B (nueva tabla)

Aunque la Opción A parece más simple, **recomiendo la Opción B** porque:
- El usuario dijo explícitamente: *"no puedes mezclar esto con lo que ya tenemos"* (en el feature anterior)
- Las relaciones son un dominio completamente distinto a solicitudes
- Evitamos riesgos de romper la funcionalidad existente
- El controller existente de gestiones (`excel.controller.js`) ya es enorme — mejor mantenerlo separado

---

## 3. ¿Qué se agrega a cada card de Relaciones?

Cada card (tanto desktop como móvil) tendrá estos **botones de acción** en la parte inferior:

### Escritorio

```
┌──────────────────────────────────────────┐
│ 🔵 ALTA       0928492123           # 3   │
├──────────────────────────────────────────┤
│ 👤 COBOS MENOSCAL ALEXANDRA LUCIA        │
│ 📱 0991234567                            │
├──────────────────────────────────────────┤
│ 📅 Inicio: 2024-01-15   🏁 Fin: 2025... │
│ ...                                      │
├──────────────────────────────────────────┤
│ [📞 Llamada] [💬 WhatsApp] [💬 Directo]  │  ← NUEVOS
│ [📋 Seguimiento] [👁️ Ver] [📋 Historial]│
└──────────────────────────────────────────┘
```

### Móvil

```
┌──────────────────────────────┐
│ 🔵 ALTA  0928492123   #3    │
├──────────────────────────────┤
│ 👤 COBOS MENOSCAL ALEXANDRA │
│ 📱 0991234567                │
│ 📅 2024-01-15 🏁 2025-06-30 │
├──────────────────────────────┤
│ [📞] [💬] [📋] [👁️] [📋 H]  │  ← NUEVOS
└──────────────────────────────┘
```

---

## 4. Funcionalidades detalladas

### 4.1 Botón 📞 Llamada
- Abre `tel:` en móvil (abre el marcador)
- En desktop: copia el número al portapapeles o muestra el número (no hay app de llamadas)
- Registra automáticamente una gestión tipo "Llamada" con fecha y hora

### 4.2 Botón 💬 WhatsApp (gestión rápida)
- Abre el modal de gestión con tipo "WhatsApp" preseleccionado
- El usuario escribe observación y guarda
- Opcional: abre WhatsApp después de guardar

### 4.3 Botón 💬 WhatsApp Directo
- Abre modal con mensaje predeterminado (igual que en Campañas)
- El mensaje incluye el primer nombre del cliente
- Al enviar: guarda la gestión + abre WhatsApp Web/App

### 4.4 Botón 📋 Seguimiento / Otros tipos
- Abre modal de gestión con tipo seleccionado (Llamada, WhatsApp, Seguimiento, Cobranza, Cita, Completada, Otro)
- El usuario escribe observación y guarda

### 4.5 Botón 👁️ Ver Gestión
- Muestra la última gestión registrada para esa relación (solo si existe)
- Muestra tipo, fecha y observación

### 4.6 Botón 📋 Historial
- Timeline de todas las gestiones registradas para esa relación
- Misma interfaz que en Campañas (dots + línea temporal)

---

## 5. Backend: Nueva API

### Controller: `src/controllers/relacionesGestion.controller.js`

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/relaciones/gestiones` | Crear nueva gestión para una relación |
| `GET` | `/api/relaciones/gestiones/:relacion_id` | Obtener gestiones de una relación |
| `GET` | `/api/relaciones/gestiones/ultimas` | Obtener última gestión de múltiples relaciones (batch) |

### Estructura de la tabla `gestiones_relaciones`

```sql
CREATE TABLE IF NOT EXISTS gestiones_relaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relacion_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tipo_gestion TEXT NOT NULL,
    observacion TEXT,
    fecha_gestion DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (relacion_id) REFERENCES relaciones(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_gestiones_relaciones_relacion_id 
ON gestiones_relaciones(relacion_id);
```

---

## 6. Frontend: Cambios en cards

### Desktop: `public/desktop/js/relaciones.js`

En la función `renderizarCards()`, agregar al final de cada card:

```javascript
var gestionada = datosRelacion.gestion_id ? true : false;

// Botones de acción
html += '<div class="card-acciones">';
html += '<button class="btn-card btn-card-call" onclick="gestionarRelacion(\'' + r.id + '\', \'Llamada\')">📞 Llamada</button>';
html += '<button class="btn-card btn-card-whatsapp" onclick="gestionarRelacion(\'' + r.id + '\', \'WhatsApp\')">💬 WhatsApp</button>';
html += '<button class="btn-card btn-card-whatsapp-direct" onclick="abrirWhatsAppRelacion(\'' + r.id + '\', \'' + escapar(r.celular) + '\', \'' + escapar(r.cliente) + '\')">💬 Directo</button>';
html += '<button class="btn-card btn-card-seguimiento" onclick="gestionarRelacion(\'' + r.id + '\', \'Seguimiento\')">📋 Seguimiento</button>';
if (gestionada) {
    html += '<button class="btn-card btn-card-ver" onclick="verGestionRelacion(\'' + r.id + '\')">👁️ Ver</button>';
}
html += '<button class="btn-card btn-card-historial" onclick="verHistorialRelacion(\'' + r.id + '\')">📋 Historial</button>';
html += '</div>';
```

### Estilos para botones (CSS)

Mismos estilos que en Campañas pero adaptados al grid de cards:

```css
.card-acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 14px 12px;
    border-top: 1px solid #f3f4f6;
}

.btn-card {
    padding: 6px 10px;
    border-radius: 8px;
    border: none;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-card:hover {
    transform: translateY(-1px);
}
```

### Móvil: `public/movil/js/relaciones.js`

Botones más compactos (solo iconos + texto corto):

```javascript
html += '<div class="card-movil-acciones">';
html += '<button onclick="gestionarRelacionMovil(\'' + r.id + '\', \'Llamada\')">📞</button>';
html += '<button onclick="gestionarRelacionMovil(\'' + r.id + '\', \'WhatsApp\')">💬</button>';
html += '<button onclick="abrirWhatsAppRelacionMovil(\'' + r.id + '\', ...)">💬→</button>';
html += '<button onclick="verHistorialRelacionMovil(\'' + r.id + '\')">📋</button>';
html += '</div>';
```

---

## 7. Reutilización de componentes existentes

Los siguientes componentes se reutilizan **tal cual** desde `gestion-lote.js`:

| Componente | Se reutiliza |
|---|---|
| Modal de gestión (tipo + observación) | ✅ Misma estructura HTML |
| Modal de WhatsApp Directo | ✅ Mismo mensaje predeterminado |
| Modal de historial (timeline) | ✅ Mismo diseño |
| Función `formatearNumeroWhatsApp()` | ✅ Misma lógica |
| Función `obtenerPrimerNombre()` | ✅ Misma lógica |
| Función `generarMensajeWhatsApp()` | ✅ Mismo mensaje |
| Función `abrirWhatsAppDesktop()` | ✅ Misma lógica (desktop) |
| Función `abrirWhatsAppMovil()` | ✅ Misma lógica (móvil) |

---

## 8. Resumen de archivos a crear/modificar

### Archivos nuevos

| Archivo | Propósito |
|---|---|
| `src/controllers/relacionesGestion.controller.js` | CRUD de gestiones de relaciones |
| `src/routes/relacionesGestion.routes.js` | Rutas API para gestiones de relaciones |

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/config/initDb.js` | Crear tabla `gestiones_relaciones` |
| `src/config/initDb.pg.js` | Crear tabla `gestiones_relaciones` |
| `app.js` | Registrar ruta `/api/relaciones/gestiones` |
| `public/desktop/js/relaciones.js` | Agregar botones + funciones de gestión/WhatsApp/llamada |
| `public/desktop/css/relaciones.css` | Estilos para botones de acción en cards |
| `public/movil/js/relaciones.js` | Agregar botones + funciones de gestión/WhatsApp/llamada |
| `public/movil/relaciones.html` | Agregar CSS de botones inline |

### Archivos NO modificados

| Archivo | Razón |
|---|---|
| `public/desktop/relaciones.html` | Los botones se agregan desde JS dinámicamente |
| `public/desktop/css/dashboard.css` | Sin cambios en dashboard |
| `public/movil/js/drawer.js` | Sin cambios en navegación |

---

## 9. Preguntas para aprobación

1. ✅ **¿Nueva tabla o reutilizar?** → **Opción B**: Nueva tabla `gestiones_relaciones` (separación limpia)
2. ✅ **¿Mismos tipos de gestión?** → Sí: Llamada, WhatsApp, Seguimiento, Cobranza, Cita, Completada, Otro
3. ✅ **¿WhatsApp Directo igual que en Campañas?** → Sí: mensaje predeterminado con nombre, guarda gestión + abre WhatsApp
4. ✅ **¿Llamada abre `tel:` en móvil?** → Sí. En desktop copia número al portapapeles
5. ❓ **¿Quieres también un botón "Exportar Excel" con las gestiones de relaciones filtradas?**
6. ❓ **¿Quieres que al hacer clic en "Llamada" se guarde automáticamente la gestión o prefieres que primero abra el modal?**

---

¿Aprobado? ✅
