# PLAN: Nueva Página "Relaciones" (ALTA / BAJA)

> **Versión:** 1.0
> **Estado:** Pendiente de aprobación
> **Prioridad:** Escritorio primero, luego móvil

---

## 1. ¿Qué es?

Un visor/filtrador independiente para gestionar clientes con estado **ALTA** (próximos a dar de baja) y **BAJA** (sin compra, sin recompra, próximos a dar de baja). Los datos provienen de un archivo Excel (`Relaciones.xlsx`) que el usuario sube **desde la propia página**.

---

## 2. Ubicación en el sistema

### Dashboard escritorio (`public/desktop/index.html`)
Se agrega un botón en **Quick Links**:

```
┌──────────────────────────────────────────────┐
│ [📤 Importar] [📋 Solicitudes] [💰 Ventas]  │
│ [📢 Campañas] [📋 Relaciones] ← NUEVO       │
└──────────────────────────────────────────────┘
```

### Drawer escritorio (`public/desktop/js/drawer.js`)
Se agrega un enlace entre "Campañas" e "Historial":

```
📊 Dashboard
💰 Control de Ventas
📤 Importar Excel
📋 Solicitudes
📝 Gestiones
📢 Campañas
📋 Relaciones        ← NUEVO
🔄 Historial
🚪 Cerrar Sesión
```

### Nav-bottom móvil y Drawer móvil
Mismo orden: después de Campañas, antes de Historial.

---

## 3. Estructura de archivos nuevos

```
src/
├── controllers/
│   └── relaciones.controller.js    ← NUEVO (índependiente)
├── routes/
│   └── relaciones.routes.js        ← NUEVO (índependiente)
├── services/
│   └── relaciones.service.js       ← NUEVO (procesamiento Excel)

public/
├── desktop/
│   ├── relaciones.html              ← NUEVO (página escritorio)
│   ├── css/
│   │   └── relaciones.css          ← NUEVO (estilos escritorio)
│   └── js/
│       └── relaciones.js           ← NUEVO (lógica escritorio)
└── movil/
    ├── relaciones.html              ← NUEVO (página móvil)
    └── js/
        └── relaciones.js           ← NUEVO (lógica móvil)
```

### Archivos a modificar:

| Archivo | Cambio |
|---|---|
| `app.js` | Agregar ruta `app.use('/api/relaciones', ...)` + rutas HTML `/relaciones` y `/m/relaciones` |
| `public/desktop/js/drawer.js` | Agregar link "📋 Relaciones" en el menú |
| `public/desktop/index.html` | Agregar botón en Quick Links |
| `public/movil/js/drawer.js` | Agregar link en drawer móvil |
| `public/movil/index.html` | Agregar link rápido si aplica |
| `src/config/initDb.js` | Agregar CREATE TABLE relaciones |
| `src/config/initDb.pg.js` | Agregar CREATE TABLE relaciones (PostgreSQL) |

---

## 4. Base de datos

### Nueva tabla `relaciones`

```sql
CREATE TABLE IF NOT EXISTS relaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    identificacion TEXT,
    cliente TEXT,
    celular TEXT,
    estado_relacion TEXT CHECK(estado_relacion IN ('ALTA','BAJA')),
    fecha_inicio_relacion DATE,
    fecha_fin_relacion DATE,
    fecha_fin_credito DATE,
    fecha_fin_fidelizacion DATE,
    proxima_baja DATE,
    motivo_ruptura TEXT,
    numero_operaciones INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
```

**Reglas:**
- Los datos pertenecen a un usuario específico (`usuario_id`)
- Al re-subir el Excel, se **reemplazan** todos los registros del usuario (no se acumulan)
- `estado_relacion` solo acepta `ALTA` o `BAJA`

---

## 5. API (backend)

### Controller: `src/controllers/relaciones.controller.js`

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/relaciones/upload` | Subir Excel, procesarlo y guardar en DB |
| `GET` | `/api/relaciones` | Listar relaciones con filtros |
| `GET` | `/api/relaciones/stats` | Contadores (total ALTA, total BAJA, total ops) |
| `DELETE` | `/api/relaciones` | Limpiar todas las relaciones del usuario |

### Service: `src/services/relaciones.service.js`

- `procesarExcel(filePath, usuarioId)` — Lee el Excel, mapea columnas, hace DELETE + INSERT masivo

### Filtros disponibles en `GET /api/relaciones`

| Parámetro | Descripción |
|---|---|
| `estado` | Filtrar por `ALTA` o `BAJA` |
| `q` | Búsqueda general (cédula, nombre, celular) |
| `fecha_desde` / `fecha_hasta` | Rango de fecha inicio relación |
| `ops_min` / `ops_max` | Rango de # operaciones |
| `orden` / `direccion` | Ordenar por columna |
| `limite` / `offset` | Paginación |

---

## 6. Frontend — Página de escritorio

### `public/desktop/relaciones.html`

Layout similar a las páginas existentes (drawer + contenido):

```
┌─────────────────────────────────────┐
│ 📋 Relaciones                       │
├─────────────────────────────────────┤
│ [📤 Subir Excel Relaciones]         │
│  ┌─ Drop zone para archivo ───────┐ │
│  │ Arrastra o selecciona .xlsx    │ │
│  └────────────────────────────────┘ │
│  [Subir y Procesar]                 │
├─────────────────────────────────────┤
│ Resumen: ● ALTA: 120  ● BAJA: 45   │
├─────────────────────────────────────┤
│ Filtros:                            │
│ ┌───┐ ┌──────────┐ ┌──────────┐    │
│ │🔍 │ │📅 Desde  │ │📅 Hasta  │    │
│ └───┘ └──────────┘ └──────────┘    │
│ [📋 Todas] [🔵 ALTA] [🔴 BAJA]    │
├─────────────────────────────────────┤
│ Tabla de resultados                 │
│ ┌────┬────────┬──────┬──────┬───┐  │
│ │Céd │Nombre  │Cel   │Estado│Ops│  │
│ ├────┼────────┼──────┼──────┼───┤  │
│ │... │...     │...   │ALTA  │ 1 │  │
│ └────┴────────┴──────┴──────┴───┘  │
│                                     │
│ [📥 Exportar Excel filtrado]        │
└─────────────────────────────────────┘
```

### Columnas del visor

| Columna | Visible | Notas |
|---|---|---|
| IDENTIFICACIÓN | ✅ | Cédula/RUC |
| CLIENTE | ✅ | Nombre completo |
| CELULAR | ✅ | Teléfono |
| ESTADO RELACIÓN | ✅ | Badge azul (ALTA) / rojo (BAJA) |
| FECHA INICIO RELACIÓN | ✅ | |
| FECHA FIN RELACIÓN | ✅ | Solo visible si BAJA |
| FECHA FIN CRÉDITO | ✅ | |
| PRÓXIMA BAJA | ✅ | Con color si está próxima |
| MOTIVO RUPTURA | ✅ | Solo si BAJA |
| # OPERACIONES | ✅ | |

### Funcionalidades clave

1. **Subida de Excel** — Drag & drop o selector de archivos, procesamiento con barra de progreso
2. **Filtros tipo píldora** — ALTA / BAJA / Todas con cambio instantáneo
3. **Búsqueda** — Por cédula o nombre en tiempo real
4. **Fechas** — Filtro por rango de fecha inicio
5. **Exportar Excel** — Misma librería SheetJS que ya se usa en Campañas
6. **Contadores** — ALTA en badge azul, BAJA en badge rojo

---

## 7. Flujo de importación

1. Usuario hace clic en "📤 Subir Excel Relaciones"
2. Selecciona el archivo `Relaciones.xlsx`
3. Al hacer submit:
   - Se envía a `POST /api/relaciones/upload`
   - El servidor **elimina todos los registros anteriores** del usuario
   - Procesa el Excel y **inserta los nuevos registros**
   - Responde con total de registros importados y conteo ALTA/BAJA
4. Se actualiza la tabla y los contadores automáticamente

---

## 8. Orden de implementación propuesto

| Paso | Descripción |
|---|---|
| 1 | Crear tabla `relaciones` en `initDb.js` e `initDb.pg.js` |
| 2 | Crear `src/services/relaciones.service.js` (procesar Excel) |
| 3 | Crear `src/controllers/relaciones.controller.js` (upload, list, stats, delete) |
| 4 | Crear `src/routes/relaciones.routes.js` y registrar en `app.js` |
| 5 | Crear `public/desktop/relaciones.html` + CSS |
| 6 | Crear `public/desktop/js/relaciones.js` (lógica completa) |
| 7 | Agregar enlace en drawer de escritorio y Quick Links del dashboard |
| 8 | Crear `public/movil/relaciones.html` + JS |
| 9 | Agregar enlace en drawer móvil y nav-bottom |
| 10 | Pruebas y revisión |

---

## 9. Consideraciones técnicas

- **Mismo patrón que `gestionesMaestro.controller.js`**: usa `pool.query()` con placeholders `?` (compatible SQLite/PostgreSQL)
- **SheetJS** para exportar: ya está en `package.json` como dependencia `exceljs`
- **Multer** para upload: ya configurado, se reutiliza o se crea config específica
- **Los datos de relaciones NO se mezclan** con `solicitudes`, `gestiones` ni ningún otro módulo
- **Cada usuario tiene sus propias relaciones** — filtro por `usuario_id`

---

## 10. Preguntas para aprobación

1. ✅ **Controller separado** — Sí, `relaciones.controller.js` independiente
2. ✅ **Importación desde la misma página** — Sí, drag & drop en la propia página
3. ✅ **Sin mezclar con otros módulos** — Sí, todo separado
4. ✅ **Desktop primero** — Sí, móvil después
5. ✅ **¿ALTA y BAJA se muestran juntos con filtros?** — Sí, píldoras para cambiar vista
6. ✅ **Al re-subir Excel se reemplazan todos los datos** — Sí (DELETE + INSERT)
7. ✅ **Exportar Excel de los datos visibles** — Sí (filtrados o todos)

---

¿Aprobado? ✅
