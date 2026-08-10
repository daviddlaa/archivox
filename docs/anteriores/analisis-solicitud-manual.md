# 📋 Registro Manual de Solicitudes — Documento de Arquitectura

**Fecha:** 11 de julio de 2026  
**Proyecto:** Archivox  
**Versión:** 1.0 (Análisis — Pendiente de implementación)

---

## FASE 1: Auditoría del Sistema

### 1.1 Estructura de la Base de Datos

#### Tabla `solicitudes` — Tabla principal

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | SERIAL PK | ✅ | ID interno autoincremental |
| `id_solicitud` | INTEGER UNIQUE | ✅* | ID de la solicitud (se auto-genera si vacío) |
| `estado` | TEXT | ❌ (default: 'SIN ESTADO') | Estado actual |
| `cedula` | TEXT | ❌ | Cédula de identidad |
| `nombre` | TEXT | ❌ | Nombre completo |
| `celular` | TEXT | ❌ | Número de celular |
| `segmento` | TEXT | ❌ | Segmento comercial |
| `producto` | TEXT | ❌ | Producto asociado |
| `codigo_plus` | TEXT | ❌ | Código interno |
| `correo_electronico` | TEXT | ❌ | Email |
| `direccion` | TEXT | ❌ | Dirección domiciliaria |
| `direccion_trabajo` | TEXT | ❌ | Dirección laboral |
| `ocupacion` | TEXT | ❌ | Ocupación |
| `ingreso_mensual` | DECIMAL(12,2) | ❌ | Ingreso mensual |
| `fecha_solicitud` | TEXT | ❌ | Fecha del registro |
| `usuario_id` | INTEGER FK | ✅ | Dueño del registro |
| `destacado` | INTEGER (0/1) | ❌ (default: 0) | Flag de destacado |
| `fecha_importacion` | TIMESTAMP | ✅ (auto) | Cuándo se creó |
| `fecha_actualizacion` | TIMESTAMP | ✅ (auto) | Última modificación |

#### Tablas relacionadas

- **`gestiones`**: Vinculada por `solicitud_id` → `solicitudes.id_solicitud`. Almacena el historial de gestiones (llamadas, seguimiento, etc.)
- **`gestiones_maestro`**: Gestión por lotes. Almacena IDs de solicitudes como JSON en `solicitudes_ids`
- **`solicitudes_referencias`**: Referencias personales vinculadas por `id_solicitud`
- **`historial_actualizaciones`**: Auditoría de cambios en solicitudes (campo, valor_anterior, valor_nuevo)
- **`notificaciones`**: Sistema de notificaciones del sistema (SSE en tiempo real)
- **`audit_log`**: Registro de acciones administrativas

#### Estados existentes detectados

- `ACTIVADA`
- `RECHAZADA`
- `DEVUELTA`
- `APROBADA PARA LIBERACIÓN`
- `SIN ESTADO` (default en importación)

#### Índices relevantes

- `idx_solicitudes_usuario_id_id` — Para listar por usuario ordenado por ID
- `idx_solicitudes_usuario_estado` — Para filtrar por estado
- `idx_solicitudes_usuario_segmento` — Para filtrar por segmento
- `idx_solicitudes_cedula_trgm` — Búsqueda por cédula (trigram)
- `idx_solicitudes_nombre_trgm` — Búsqueda por nombre
- `idx_solicitudes_celular_trgm` — Búsqueda por celular

---

### 1.2 Flujo Actual de Creación de Solicitudes

#### Única vía actual: Importación por Excel

```
Usuario → Sube archivo Excel → POST /api/excel/upload
  → excel.service.procesarExcel()
    → Lee fila por fila desde la fila 2
    → Normaliza: ID auto-generado, estado default "SIN ESTADO", fecha formateada
    → Detecta duplicados por cédula o id_solicitud
    → INSERT o UPDATE según exista
    → Guarda auditoría si cambió estado/segmento
  → Responde con total de inserts/updates
```

#### Procesos que intervienen

1. **Middleware de autenticación** (`requiresAuth`) — valida sesión
2. **Multer** — maneja la subida de archivos
3. **ExcelJS** — procesa el Excel
4. **Servicio de auditoría** (`historial_actualizaciones`) — solo en updates
5. **Sin notificaciones** — no se generan notificaciones al importar

#### Validaciones actuales

- Campos vacíos se normalizan con valores por defecto
- IDs duplicados se detectan y actualizan en lugar de insertar
- Solo se auditan cambios de `estado` y `segmento`
- No hay validación de formato de cédula, nombre o teléfono
- Los campos adicionales (código_plus, correo, dirección, etc.) se completan después mediante "Completar Info"

---

## FASE 2: Diseño Funcional

### 2.1 Ubicación de los Accesos

#### ✅ Botón Flotante de Acción Rápida (FAB) — RECOMENDADO

Un FAB es el mecanismo ideal porque:
- Está siempre visible sin importar dónde esté el usuario en la página
- Es un estándar UX en aplicaciones modernas (Gmail, Trello, Asana)
- Funciona en móvil y escritorio con la misma metáfora visual
- No interfiere con el contenido existente

#### Ubicaciones específicas:

| Ubicación | Prioridad | Justificación |
|---|---|---|
| **Módulo de Solicitudes** | ⭐ Alta | Es el lugar natural |
| **Dashboard** | ⭐ Alta | Acceso rápido para usuarios frecuentes |
| **Drawer lateral** | ⭐ Media | Acceso secundario desde cualquier página |
| **Barra de acciones** | ✅ Adicional | Junto a "Importar Excel" |

#### Propuesta de jerarquía de accesos:

1. FAB en página de Solicitudes (principal)
2. Botón "➕ Nueva Solicitud" en la barra de acciones del módulo
3. Card de acceso rápido en el Dashboard
4. Enlace en el Drawer lateral

### 2.2 Visibilidad por Rol

| Rol | Acceso |
|---|---|
| `user` | ✅ Acceso completo |
| `admin` | ✅ Acceso completo |
| `superadmin` | ✅ Acceso completo + puede crear para otros usuarios |

---

## FASE 3: Diseño del Formulario

### 3.1 Estructura

**Enfoque:** Formulario de una sola página con secciones agrupadas.
**Justificación:** El número de campos obligatorios es manejable (3-4 campos clave). Un wizard añadiría fricción innecesaria.

#### Orden lógico de los campos:

```
┌─────────────────────────────────────────┐
│  📋 NUEVA SOLICITUD                     │
├─────────────────────────────────────────┤
│                                         │
│  ┌── Información del Cliente ──────┐    │
│  │  📝 Nombre *                   │    │
│  │  🆔 Cédula *                   │    │
│  │  📞 Celular *                   │    │
│  │  📧 Correo Electrónico         │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌── Datos del Producto ──────────┐    │
│  │  📦 Producto                   │    │
│  │  🏷️ Segmento (selector)       │    │
│  │  🔢 Código Plus                │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌── Información Adicional ───────┐    │
│  │  📍 Dirección                  │    │
│  │  💼 Ocupación                  │    │
│  │  💰 Ingreso Mensual            │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌── Estado Inicial ──────────────┐    │
│  │  📌 Estado * (selector)        │    │
│  └────────────────────────────────┘    │
│                                         │
│  [ ❌ Cancelar ]    [ 💾 Guardar ]     │
└─────────────────────────────────────────┘
```

#### Campos obligatorios

- **Nombre** — identificador principal
- **Cédula** — identificador único (validar formato 10 dígitos)
- **Celular** — contacto principal
- **Estado** — ¿en qué estado nace?

#### Campos opcionales

Todos los demás. El formulario debe ser funcional incluso si solo se llenan los obligatorios.

### 3.2 Validaciones en Tiempo Real

| Campo | Validación | Feedback |
|---|---|---|
| Cédula | 10 dígitos numéricos, validación dígito verificador | ✅/❌ inline |
| Celular | 10 dígitos, formato ecuatoriano | ✅/❌ inline |
| Correo | Formato email estándar | ✅/❌ inline |
| Ingreso Mensual | Número positivo | ❌ si es negativo |
| Nombre | Mínimo 3 caracteres | ❌ si está vacío |

#### Estados disponibles

Cargados dinámicamente desde la BD. Default: `SIN ESTADO`.

#### Segmentos disponibles

Cargados dinámicamente desde `GET /api/excel/dashboard/segmentos`.

### 3.3 Experiencia Mobile vs Desktop

#### Escritorio
- Modal grande o panel lateral (drawer derecho)
- Diseño de 2 columnas para campos relacionados
- Tooltips informativos
- Atajos de teclado (Enter guardar, Escape cancelar)

#### Móvil
- Pantalla completa (no modal)
- 1 columna, campos apilados
- Input types optimizados (tel, number, email)
- Botón de guardar fijo en la parte inferior (sticky)

---

## FASE 4: Integración con el Sistema

### 4.1 Comportamiento Post-Creación

Cuando una solicitud se crea manualmente, debe comportarse idénticamente a una importada:

| Aspecto | Integración |
|---|---|
| **Listado** | Aparece en `GET /api/excel/solicitudes` |
| **Filtros** | Respeta filtros por estado, segmento, búsqueda |
| **Paginación** | Se cuenta en el total y aparece en scroll infinito |
| **Dashboard** | Se actualizan los contadores |
| **Estadísticas** | Se incluye en promedios |
| **Gestiones** | Se le pueden asociar gestiones |
| **Auditoría** | Se registra en `historial_actualizaciones` |
| **Notificaciones** | Se puede crear notificación de "nueva solicitud" |
| **Campañas** | Se puede agregar a `gestiones_maestro` |
| **Exportación** | Se exporta junto con las demás |

### 4.2 Reglas de Negocio

1. **`id_solicitud` único**: Auto-generado secuencialmente
2. **Segmentación por `usuario_id`**: Cada usuario ve solo sus solicitudes
3. **Estados dinámicos**: No hay estados fijos en código
4. **Advertencia de duplicados por cédula**: Si ya existe una solicitud con esa cédula para el mismo usuario

---

## FASE 5: Impacto en el Sistema

### 5.1 Módulos Afectados

#### Backend

| Archivo | Cambio |
|---|---|
| `src/controllers/excel.controller.js` | ✅ Nueva función `crearSolicitudManual()` |
| `src/routes/excel.routes.js` | ✅ Nueva ruta `POST /api/excel/solicitudes` |
| `src/services/excel.service.js` | ✅ Nueva función `crearSolicitud()` |

#### Frontend Desktop

| Archivo | Cambio |
|---|---|
| `public/desktop/solicitudes.html` | ✅ Agregar FAB + modal del formulario |
| `public/desktop/js/solicitudes.js` | ✅ Lógica del formulario + validaciones + submit |
| `public/desktop/css/solicitudes.css` | ✅ Estilos del FAB + modal |
| `public/desktop/index.html` | ✅ Card de acceso rápido en Dashboard |
| `public/desktop/js/dashboard.js` | ✅ Lógica del acceso rápido |
| `public/desktop/css/dashboard.css` | ✅ Estilos de la card de acceso |

#### Frontend Móvil

| Archivo | Cambio |
|---|---|
| `public/movil/solicitudes.html` | ✅ Agregar FAB + formulario en pantalla completa |
| `public/movil/js/solicitudes.js` | ✅ Lógica del formulario móvil |
| `public/movil/css/solicitudes-mobile.css` | ✅ Estilos del FAB + formulario móvil |
| `public/movil/index.html` | ✅ Card de acceso rápido en Dashboard |
| `public/movil/js/dashboard.js` | ✅ Lógica del acceso rápido |

#### CSS Compartido

| Archivo | Cambio |
|---|---|
| `public/css/solicitudes.css` | ✅ Estilos compartidos |

### 5.2 API — Nueva Ruta

```
POST /api/excel/solicitudes
Content-Type: application/json

Body:
{
  "nombre": "Juan Pérez",                    // REQUERIDO
  "cedula": "1234567890",                     // REQUERIDO
  "celular": "0991234567",                    // REQUERIDO
  "estado": "SIN ESTADO",                    // REQUERIDO (default)
  "correo_electronico": "juan@ejemplo.com",  // OPCIONAL
  "segmento": "VIP",                         // OPCIONAL
  "producto": "Crédito",                     // OPCIONAL
  "codigo_plus": "PLUS-001",                 // OPCIONAL
  "direccion": "Av. Siempre Viva 123",       // OPCIONAL
  "direccion_trabajo": "Oficina 456",        // OPCIONAL
  "ocupacion": "Comerciante",               // OPCIONAL
  "ingreso_mensual": 1500.00                 // OPCIONAL
}

Response 201:
{
  "id_solicitud": 1234,
  "mensaje": "Solicitud creada correctamente"
}
```

### 5.3 Cambios en la Base de Datos

**No se requieren cambios en el esquema.** La tabla `solicitudes` ya contiene todos los campos necesarios.

### 5.4 Riesgos Identificados

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| IDs duplicados por concurrencia | Baja | Usar transacción con `SELECT ... FOR UPDATE` o secuencia PostgreSQL |
| Cédulas duplicadas para un mismo usuario | Media | Validar antes de insertar: advertir pero permitir crear |
| Formulario abandonado (datos perdidos) | Media | Autoguardado en `localStorage` |
| Usuarios creando solicitudes incompletas | Media | Marcar obligatorios visualmente, permitir guardar con solo nombre |
| Rendimiento con muchas solicitudes | Baja | El sistema ya maneja paginación e índices optimizados |

### 5.5 Compatibilidad

- 100% compatible con solicitudes existentes
- Las solicitudes manuales aparecen en todos los listados, filtros, búsquedas y exportaciones
- No rompe ninguna funcionalidad existente

---

## Plan de Implementación por Fases

### Fase 1: Backend (API y Lógica de Negocio)

1. Crear función `crearSolicitudManual()` en `excel.controller.js`
   - Validar campos obligatorios
   - Auto-generar `id_solicitud` secuencial
   - Insertar en `solicitudes` con `usuario_id` de la sesión
   - Detectar duplicados por cédula
   - Opcional: emitir notificación vía `notificationBus`
2. Agregar ruta `POST /api/excel/solicitudes` autenticada
3. Agregar endpoint `GET /api/excel/solicitudes/estados-disponibles`

### Fase 2: Frontend Desktop

1. Agregar FAB en página de Solicitudes
2. Crear modal del formulario con diseño en 2 columnas
3. Validaciones en tiempo real
4. Conectar con la API
5. Agregar acceso en Dashboard y barra de acciones

### Fase 3: Frontend Móvil

1. Agregar FAB en página de Solicitudes móvil
2. Crear formulario en pantalla completa
3. Validaciones adaptadas a touch
4. Conectar con la API
5. Agregar acceso en Dashboard móvil

### Fase 4: Integración y Pruebas

1. Verificar listados, filtros y búsquedas
2. Verificar dashboard y estadísticas
3. Verificar gestión (gestiones, campañas, completar info)
4. Verificar exportación a Excel

---

## Recomendaciones para Escalabilidad

1. **Arquitectura modular**: Crear `crearSolicitud()` en `excel.service.js` reutilizable
2. **Estados dinámicos**: No hardcodear estados. Cargarlos desde la BD
3. **Campos extensibles**: La tabla ya soporta nuevos campos solo agregándolos al formulario y al INSERT
4. **Origen de datos**: Considerar columna `origen TEXT DEFAULT 'excel' CHECK(origen IN ('excel', 'manual'))` para trazabilidad futura
5. **Validación de cédula ecuatoriana**: Implementar validación del dígito verificador como mejora opcional
6. **Autocompletado inteligente**: Si el usuario ya existe (misma cédula), precargar datos conocidos
