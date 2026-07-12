# INFORME TÉCNICO: Sistema de Deep Links Multiplataforma

**Proyecto:** ARCHIVOX
**Fecha:** Julio 2026
**Versión:** 2.0
**Autor:** Arquitectura de Software

---

## 1. Problema Detectado

Las notificaciones del sistema pueden redirigir a un usuario a una página que **no corresponde con su plataforma actual** (Desktop vs Mobile).

**Escenario de fallo:**
1. El administrador crea una notificación con deep link `/solicitudes` (Desktop)
2. Un usuario que está usando la versión Mobile recibe la notificación
3. Hace clic en la notificación
4. Es redirigido a la versión Desktop de Solicitudes
5. Resultado: interfaz incorrecta, layout roto, experiencia inconsistente

---

## 2. Causa Raíz

El sistema anterior almacenaba **URLs fijas** (ej: `/solicitudes` o `/m/solicitudes`) en la columna `accion_url` de la tabla `notificaciones`. El administrador debía elegir manualmente la plataforma al crear la notificación, pero **no sabe qué plataforma usará el destinatario**.

**Archivo fuente del problema:**
- `public/admin/js/admin.js` — Array `DEEP_LINKS` con URLs fijas por plataforma
- `public/js/notificaciones-dashboard.js` — `window.location.href = accionUrl` sin validación de plataforma

---

## 3. Arquitectura Anterior

```
Admin selecciona URL fija
        │
        ▼
  accion_url = "/solicitudes" (Desktop)
  O
  accion_url = "/m/solicitudes" (Mobile)
        │
        ▼
  BD: notificaciones.accion_url
        │
        ▼
  SSE → notificaciones-dashboard.js
        │
        ▼
  window.location.href = accionUrl (SIN validación)
        │
        ▼
  ⚠️ El usuario mobile recibe URL desktop → Layout roto
```

**Problemas de la arquitectura anterior:**
1. Acoplamiento: la URL contiene información de plataforma
2. El admin decide por el usuario qué plataforma usar
3. No escalable: agregar una nueva plataforma requiere duplicar todas las rutas
4. Sin validación: el frontend navega sin verificar compatibilidad

---

## 4. Arquitectura Nueva (Opción B - Identificador Lógico)

```
Admin selecciona MÓDULO (ej: "Solicitudes")
        │
        ▼
  accion_modulo = "solicitudes" (SIN plataforma)
        │
        ▼
  BD: notificaciones.accion_modulo = "solicitudes"
  BD: notificaciones.accion_url = null (o legacy)
        │
        ▼
  SSE → notificaciones-dashboard.js
        │
        ▼
  DeepLinkRouter.resolver("solicitudes")
        │
        ├── Desktop → "/solicitudes"
        └── Mobile  → "/m/solicitudes"
        │
        ▼
  window.location.href = URL_CORRECTA ✅
```

**Principios de la nueva arquitectura:**
1. **Desacoplamiento**: el admin solo indica QUÉ módulo, no CÓMO llegar
2. **Resolución por plataforma**: cada frontend (Desktop/Mobile) resuelve su propia URL
3. **Escalabilidad**: agregar una nueva plataforma solo requiere agregar rutas en `DeepLinkRouter`
4. **Compatibilidad hacia atrás**: notificaciones legacy con `accion_url` directa siguen funcionando

---

## 5. Flujo Completo del Deep Link

### 5.1 Creación de notificación (Admin)

```
1. Admin abre modal de crear notificación
2. Selector de "Acción" carga módulos desde DeepLinkRouter.getModulos()
   └── { id: "solicitudes", label: "Solicitudes", icon: "📋", rutas: {...} }
3. Admin selecciona "Solicitudes" (solo el módulo, sin elegir plataforma)
4. Admin hace clic en "Publicar"
   └── POST /api/admin/notificaciones
       ├── accion_modulo: "solicitudes"
       ├── accion_url: null (ya no se envía URL directa)
       ├── accion_texto: "Ir a 📋 Solicitudes"
       └── ... resto de campos
5. Backend guarda en BD:
   └── INSERT INTO notificaciones (accion_modulo, accion_url, ...)
       VALUES ('solicitudes', NULL, ...)
6. Backend emite SSE:
   └── notificationBus.emitir('notification.created', notificacion)
       └── incluye accion_modulo: "solicitudes"
```

### 5.2 Recepción de notificación (Usuario)

```
1. Usuario recibe notificación vía SSE
   └── notificacion.accion_modulo = "solicitudes"
2. notificaciones-dashboard.js renderiza tarjeta:
   └── data-accion-modulo="solicitudes"
   └── data-accion-url="" (vacío)
3. Usuario hace clic en la notificación
   └── marcarLeidaUsuario(id, accionUrl, accionModulo)
       ├── Marca como leída (PUT /api/admin/notificaciones/:id/leer)
       ├── DeepLinkRouter.resolver("solicitudes")
       │   ├── ¿Es Mobile? → "/m/solicitudes" ✅
       │   └── ¿Es Desktop? → "/solicitudes" ✅
       └── window.location.href = URL_CORRECTA
```

### 5.3 Compatibilidad hacia atrás (Notificaciones legacy)

```
1. Notificación legacy con accion_url = "/m/solicitudes"
   └── accion_modulo = null (no existía antes)
2. Usuario hace clic
   └── marcarLeidaUsuario(id, "/m/solicitudes", null)
       ├── No hay accion_modulo → usar accion_url
       ├── DeepLinkRouter.corregirUrl("/m/solicitudes")
       │   ├── ¿Es Desktop? → URL tiene /m/ → Corregir a "/solicitudes"
       │   └── ¿Es Mobile? → URL tiene /m/ → Correcta, mantener
       └── window.location.href = URL_CORREGIDA
```

---

## 6. Archivos Modificados

| Archivo | Cambio | Propósito |
|---------|--------|-----------|
| `public/js/deep-link-router.js` | **NUEVO** | Sistema centralizado de resolución de rutas por plataforma |
| `public/js/notificaciones-dashboard.js` | MODIFICADO | Usa DeepLinkRouter para navegar; acepta accion_modulo |
| `public/admin/js/admin.js` | MODIFICADO | Selector usa módulos lógicos; envía accion_modulo en lugar de URL fija |
| `src/controllers/notificaciones.controller.js` | MODIFICADO | Acepta y guarda accion_modulo; lo incluye en evento SSE |
| `src/config/initDb.js` | MODIFICADO | Agrega columna accion_modulo + migración legacy |
| `src/config/initDb.pg.js` | MODIFICADO | Agrega columna accion_modulo + migración legacy |
| `public/desktop/index.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/movil/index.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/desktop/solicitudes.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/movil/solicitudes.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/desktop/gestiones.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/desktop/gestion-lote.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/desktop/relaciones.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/desktop/ventas.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/desktop/importar.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/desktop/historial.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/perfil.html` | MODIFICADO | Incluye deep-link-router.js |
| `public/admin/index.html` | MODIFICADO | Incluye deep-link-router.js |

---

## 7. Endpoints Afectados

| Endpoint | Cambio |
|----------|--------|
| `POST /api/admin/notificaciones` | Acepta nuevo campo `accion_modulo` (opcional) |
| `GET /api/admin/notificaciones` | Devuelve `accion_modulo` en la respuesta (sin cambios en query) |
| `GET /api/admin/notificaciones/stream (SSE)` | Incluye `accion_modulo` en eventos `notification.created` |

**NOTA:** Ningún endpoint cambia su firma o rompe compatibilidad. Todos los campos nuevos son opcionales.

---

## 8. Tablas Afectadas

### Tabla: `notificaciones`

| Columna | Tipo | Cambio | Descripción |
|---------|------|--------|-------------|
| `accion_modulo` | TEXT | **NUEVA** | Identificador lógico del módulo (ej: 'solicitudes', 'dashboard') |
| `accion_url` | TEXT | Sin cambios | Se mantiene para compatibilidad hacia atrás |

**Migración SQLite:**
```sql
ALTER TABLE notificaciones ADD COLUMN accion_modulo TEXT;
```

**Migración PostgreSQL:**
```sql
ALTER TABLE notificaciones ADD COLUMN accion_modulo TEXT;
```

**Migración de datos legacy (automática):**
La migración infiere `accion_modulo` desde `accion_url` existente usando un mapeo de URLs conocidas a módulos. Se ejecuta automáticamente al iniciar el servidor.

---

## 9. Compatibilidad con Desktop ✅

- El DeepLinkRouter detecta automáticamente si es Desktop
- Todas las rutas Desktop están definidas en el router
- Las notificaciones legacy con URLs Desktop funcionan sin cambios
- Las notificaciones legacy con URLs Mobile se corrigen automáticamente

## 10. Compatibilidad con Mobile ✅

- El DeepLinkRouter detecta automáticamente si es Mobile por URL path y User-Agent
- Todas las rutas Mobile están definidas en el router
- Las notificaciones legacy con URLs Mobile funcionan sin cambios
- Las notificaciones legacy con URLs Desktop se corrigen automáticamente

## 11. Compatibilidad con Versiones Anteriores ✅

**Backward compatibility garantizada:**
1. Notificaciones existentes con `accion_url` directa → Siguen funcionando
2. DeepLinkRouter.corregirUrl() corrige URLs de plataforma incorrecta
3. La migración automática infiere `accion_modulo` desde `accion_url` legacy
4. El campo `accion_modulo` es opcional en API y BD
5. El selector de admin muestra módulos, pero acepta URLs legacy (formato que empieza con `/`)

---

## 12. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Admin usa URL directa en lugar de módulo | Baja | Bajo | El código detecta si el valor empieza con `/` (URL) o no (moduleId) |
| Módulo no encontrado en DeepLinkRouter | Baja | Medio | Fallback a accion_url legacy; warning en consola |
| User-Agent no detecta Mobile correctamente | Baja | Medio | La detección por URL path (/m/) es prioritaria |
| Notificaciones muy antiguas sin accion_url ni accion_modulo | Baja | Bajo | Se ignora, no hay navegación (solo informativa) |

---

## 13. Casos de Prueba

### CP-01: Notificación nueva con módulo (Desktop)
1. Admin crea notificación con módulo "Solicitudes"
2. Usuario en Desktop recibe y hace clic
3. **Esperado:** Navega a `/solicitudes`

### CP-02: Notificación nueva con módulo (Mobile)
1. Admin crea notificación con módulo "Solicitudes"
2. Usuario en Mobile recibe y hace clic
3. **Esperado:** Navega a `/m/solicitudes`

### CP-03: Notificación legacy con URL Desktop desde Mobile
1. Existe notificación con `accion_url = "/solicitudes"`
2. Usuario en Mobile recibe y hace clic
3. **Esperado:** DeepLinkRouter corrige → navega a `/m/solicitudes`

### CP-04: Notificación legacy con URL Mobile desde Desktop
1. Existe notificación con `accion_url = "/m/solicitudes"`
2. Usuario en Desktop recibe y hace clic
3. **Esperado:** DeepLinkRouter corrige → navega a `/solicitudes`

### CP-05: Notificación sin acción
1. Admin crea notificación sin acción (solo informativa)
2. Usuario hace clic
3. **Esperado:** Solo marca como leída, no navega

### CP-06: Selector de admin muestra solo módulos (sin duplicados Desktop/Mobile)
1. Admin abre modal de crear notificación
2. **Esperado:** Selector muestra "Solicitudes" (una vez), no "/solicitudes" y "/m/solicitudes"

### CP-07: DeepLinkRouter.getModulos()
1. Llamar `DeepLinkRouter.getModulos({ incluirAdmin: false })`
2. **Esperado:** No incluye módulos `adminOnly`

### CP-08: DeepLinkRouter.resolver() con plataforma forzada
1. `DeepLinkRouter.resolver('solicitudes', true)` → debe devolver `/m/solicitudes`
2. `DeepLinkRouter.resolver('solicitudes', false)` → debe devolver `/solicitudes`

---

## 14. Recomendaciones Futuras

1. **Agregar validación visual en el admin:** Mostrar un preview de la ruta según la plataforma seleccionada del destinatario (si se conoce).

2. **Historial de navegación de notificaciones:** Registrar a dónde navegó cada usuario desde una notificación (útil para auditoría).

3. **Deep Links con parámetros dinámicos:** Actualmente los módulos solo mapean rutas base. En el futuro se podría agregar soporte para parámetros como `solicitudes?id=123`.

4. **PWA / Service Worker:** Para cuando se implemente modo offline, el DeepLinkRouter podría integrarse con Service Workers para manejar la navegación incluso sin conexión.

5. **Internacionalización:** DeepLinkRouter podría soportar rutas localizadas en el futuro.

6. **Analytics:** Agregar tracking de clics en notificaciones para medir efectividad.

---

## 15. Diagrama de Clases (DeepLinkRouter)

```
DeepLinkRouter
│
├── MODULOS (Array)
│   ├── { id, label, icon, rutas: { desktop, mobile }, adminOnly? }
│   └── ...
│
├── MODULOS_POR_ID (Map acelerador)
│
├── getModulos(opts) → Array
├── getModulo(moduleId) → Object|null
├── resolver(moduleId, forzarMobile?, forzarDesktop?) → String|null
├── resolverUrl(notificacion) → String|null
├── getTextoAccion(moduleId) → String
├── esUrlDePlataformaIncorrecta(url) → Boolean
└── corregirUrl(url) → String
```

---

## 16. Ejemplo de Uso (Código)

```javascript
// En notificaciones-dashboard.js (Frontend)
async function marcarLeidaUsuario(id, accionUrl, accionModulo) {
    // ... marcar como leída ...

    var urlNavegacion = null;

    // 1. Resolver por módulo lógico
    if (accionModulo && typeof DeepLinkRouter !== 'undefined') {
        urlNavegacion = DeepLinkRouter.resolver(accionModulo);
    }

    // 2. Fallback: URL legacy con corrección de plataforma
    if (!urlNavegacion && accionUrl) {
        if (typeof DeepLinkRouter !== 'undefined') {
            urlNavegacion = DeepLinkRouter.corregirUrl(accionUrl);
        } else {
            urlNavegacion = accionUrl;
        }
    }

    // 3. Navegar
    if (urlNavegacion) {
        window.location.href = urlNavegacion;
    }
}

// En admin.js (Panel de Administración)
const modulos = DeepLinkRouter.getModulos({ incluirAdmin: false });
modulos.forEach(function(m) {
    selector.innerHTML += '<option value="' + m.id + '">' + m.icon + ' ' + m.label + '</option>';
});

// Al crear notificación
const body = {
    accion_modulo: 'solicitudes',  // Nuevo campo
    accion_url: null,              // Ya no se envía URL directa
    accion_texto: 'Ir a Solicitudes',
    // ... resto de campos
};
```

---

## Resumen

La nueva arquitectura de Deep Links resuelve el problema de raíz al **desacoplar la intención del admin** (qué módulo) **de la implementación técnica** (qué URL). Cada plataforma resuelve su propia ruta, garantizando que la navegación siempre sea correcta independientemente de dónde se reciba la notificación.

**Cambios clave:**
- ✅ Nuevo `DeepLinkRouter` — sistema centralizado de resolución de rutas
- ✅ Admin selecciona módulos, no URLs — sin duplicados Desktop/Mobile
- ✅ Compatibilidad hacia atrás — notificaciones legacy siguen funcionando
- ✅ Sin cambios en endpoints — solo se agregó campo opcional
- ✅ Migración automática de datos legacy
- ✅ Preparado para futuras plataformas
