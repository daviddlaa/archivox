# 🗺️ Estado del Proyecto — Archivox (Implementado vs Pendiente)

> **Propósito de este documento:** que no te pierdas. Aquí está el resumen de **qué ya está implementado** y **qué falta por hacer**, con enlaces a la documentación de cada cosa.
> **Última actualización:** 18/08/2026

---

## 1. 🧭 Cómo leer la documentación

Los nombres de los archivos en `docs/` siguen una convención — si entiendes el prefijo, sabes de qué trata sin abrirlo:

| Prefijo | Qué es | Estado típico |
|---|---|---|
| `feature-*` | Registro de una funcionalidad implementada (con fecha y ámbito) | ✅ Implementado |
| `fix-*` | Registro de una corrección aplicada | ✅ Implementado |
| `progreso-*` | Historial de avance de un trabajo (la mayoría marcados `✅ COMPLETADO`) | ✅ Completado |
| `migration-*` / `MIGRACION_*` | Migraciones de BD o de hosting | ⚠️ Revisar (aplicada o plan) |
| `informe-*` | Análisis, auditorías y reportes técnicos | 📄 Informe (no es trabajo pendiente) |
| `plan-*` | Planes con fases de trabajo | 📋 Contiene lo pendiente |
| `convencion-*` | Reglas/convenciones vigentes | ✅ Vigente |

> **Regla rápida:** si un archivo empieza con `feature-`, `fix-` o `progreso-`, **ya está hecho**. Si dice `plan-`, lee su banner de **Estado** para ver qué fase va. Lo pendiente del proyecto vive en **una sola fuente: la sección 3 de este documento**.

---

## 2. ✅ Lo implementado (resumen por módulo)

Todo lo de esta sección está **en producción/desarrollado**; cada ítem enlaza a su documento.

### 📱 Campañas (gestión por lotes)
- Rediseño del Indicador de Estado (Semáforo) v6.1 — [`feature-rediseño-semaforo-campañas.md`](feature-rediseño-semaforo-campañas.md)
- UX de campañas con progreso y prioridad v2.0 — [`feature-ux-comportamiento-campanas.md`](feature-ux-comportamiento-campanas.md)
- Prioridad por tiempo sin seguimiento (orden + toast + badge ⏱️) — [`feature-prioridad-tiempo-sin-seguimiento.md`](feature-prioridad-tiempo-sin-seguimiento.md)
- Historial general de campaña ("🕘 Últimas gestiones") — [`feature-historial-campana.md`](feature-historial-campana.md)
- Recordatorios ⏰ de llamada/mensaje + notificación in-app — [`feature-recordatorios-campanas.md`](feature-recordatorios-campanas.md)
- Calendario inteligente de recordatorios (mes + lista del día) — [`feature-calendario-recordatorios.md`](feature-calendario-recordatorios.md)
- Landing de campañas (grid + selector hero) — [`feature-grid-campanas-landing.md`](feature-grid-campanas-landing.md)
- Búsqueda global de solicitudes en todas las campañas — [`feature-buscador-global-campanas.md`](feature-buscador-global-campanas.md)
- Buscador inline en Campañas móvil — [`feature-buscador-inline-campanas-movil.md`](feature-buscador-inline-campanas-movil.md)
- Campaña completada sale del semáforo — [`feature-semaforo-campana-completada.md`](feature-semaforo-campana-completada.md)
- Guía didáctica de clasificación (una vez por usuario) — [`feature-guia-clasificacion-campanas.md`](feature-guia-clasificacion-campanas.md)
- Límite de líneas del texto de seguimiento en tarjetas — [`feature-limite-texto-seguimiento-tarjetas.md`](feature-limite-texto-seguimiento-tarjetas.md)

### 📞 Métricas de gestión (Fase 1 del plan)
- **Popup de llamada con contador** desde el botón 📞 de cada tarjeta (móvil): duración real + resultado estructurado (9 buckets) — [`plan-metricas-llamadas-semaforo.md`](plan-metricas-llamadas-semaforo.md) §8
- Columnas `duracion_seg`, `llamada_inicio/fin`, `resultado`, `metodo_duracion` en `gestiones` (SQLite + PostgreSQL)
- Corrección del flujo de guardado de seguimientos en campañas — [`informe-correccion-flujo-seguimiento-campanas.md`](informe-correccion-flujo-seguimiento-campanas.md)

### 📋 Solicitudes
- Panel lateral de detalle/edición (escritorio) — [`feature-panel-lateral-solicitudes.md`](feature-panel-lateral-solicitudes.md)
- Tarjeta de Solicitudes escritorio (sin Llamar, cédula+teléfono, fixes) — [`feature-tarjeta-solicitudes-escritorio.md`](feature-tarjeta-solicitudes-escritorio.md)
- Header unificado + filtros con auto-aplicar (desktop) — [`feature-header-filtros-solicitudes-desktop.md`](feature-header-filtros-solicitudes-desktop.md)
- Filtros móviles compactos — [`feature-filtros-movil-solicitudes.md`](feature-filtros-movil-solicitudes.md)
- Filtros de fecha (Desde/Hasta) para todos — [`feature-filtros-fecha-todos-solicitudes.md`](feature-filtros-fecha-todos-solicitudes.md)
- Rediseño tarjeta móvil (compacta, Gestiones = historial, ⋮→🗑️) — [`feature-rediseno-tarjeta-movil-solicitudes.md`](feature-rediseno-tarjeta-movil-solicitudes.md)
- Cédula visible en tarjeta móvil — [`feature-cedula-tarjeta-movil-solicitudes.md`](feature-cedula-tarjeta-movil-solicitudes.md)
- Flag "Ya no aplica para crédito" (👍👎) — [`feature-no-aplica-credito.md`](feature-no-aplica-credito.md)
- Catálogos globales en Nueva Solicitud — [`feature-catalogos-globales-nueva-solicitud.md`](feature-catalogos-globales-nueva-solicitud.md)
- UX "Agregar a Campaña" — [`feature-ux-agregar-campana-solicitudes.md`](feature-ux-agregar-campana-solicitudes.md)
- Columna "vendedor" en solicitudes — [`feature-columna-vendedor-solicitudes.md`](feature-columna-vendedor-solicitudes.md)
- Importación Excel protegida (nunca toca registros ajenos) — [`fix-importacion-proteccion-datos-usuarios.md`](fix-importacion-proteccion-datos-usuarios.md)

### 👥 Equipos / Panel del líder
- Rediseño del panel del líder móvil (3 tabs, detalle de agente) — [`feature-rediseno-equipo-movil.md`](feature-rediseno-equipo-movil.md)
- Panel lateral de gestión de agentes (escritorio) — [`feature-panel-lateral-agentes.md`](feature-panel-lateral-agentes.md)
- Sistema Multi-Equipo v3.0 — [`informe-arquitectura-multi-equipo.md`](informe-arquitectura-multi-equipo.md) y [`informe-modelo-datos-multi-equipo.md`](informe-modelo-datos-multi-equipo.md)

### 🛠️ Admin / SuperAdmin
- Backup de BD con un clic (dump SQL) — [`feature-backup-dump-superadmin.md`](feature-backup-dump-superadmin.md)
- Tab Solicitudes globales (solo lectura + export CSV) — [`feature-admin-solicitudes-globales.md`](feature-admin-solicitudes-globales.md)
- Campañas "Asignadas por el sistema" — [`feature-admin-campanas-sistema.md`](feature-admin-campanas-sistema.md)

### 💬 Otros módulos
- Plantillas de mensajes personalizadas v1.5 — [`feature-plantillas-mensajes.md`](feature-plantillas-mensajes.md)
- Widget "🕘 Últimas gestiones" en dashboard — [`feature-widget-ultimas-gestiones-dashboard.md`](feature-widget-ultimas-gestiones-dashboard.md)
- Login móvil compacto — [`feature-login-movil-compacto.md`](feature-login-movil-compacto.md)
- Fix rate limiting + reconexión SSE — [`informe-rate-limit-conexiones.md`](informe-rate-limit-conexiones.md)
- Fix 500 en `/api/admin/solicitudes` + mecanismo `SCHEMA_VERSION` — [`fix-500-solicitudes-created_at.md`](fix-500-solicitudes-created_at.md)

---

## 3. 📋 Lo pendiente (por hacer)

**Fuente principal:** [`plan-metricas-llamadas-semaforo.md`](plan-metricas-llamadas-semaforo.md) (banner de Estado + sección 6) y las recomendaciones de la [`auditoría de producción`](informe-auditoria-produccion-daviddlaa.md) (sección 9 — datos faltantes).

| # | Tarea | Prioridad | Detalle |
|---|---|---|---|
| 1 | **Tabla `ventas` vinculada a gestión** | P1 | Registro de ventas con `gestion_id`, `solicitud_id`, `usuario_id`, `vendedor`, `monto`, `fecha_cierre`, `comision`, `estado`. Hoy las ventas solo existen en texto libre. (Plan §4, Fase 2) |
| 2 | **Derivación estructurada** | P1 | Columnas `vendedor_derivado` + `fecha_derivacion` en `gestiones`. Hoy "se la asigno a Jenny/Angélica/Rosita" es texto libre. (Plan §4, Fase 2) |
| 3 | **Historial del semáforo** (`semaforo_historial`) | P2 | Registra anterior→nuevo, usuario, origen, timestamp en cada cambio del selector. (Plan §2, Fase 3) |
| 4 | **Panel de métricas por campaña** | P2 | Embudo en vivo (contactados/interesados/derivados/ventas), duración promedio de llamada, semáforo. (Plan §5.4, Fase 3) |
| 5 | **Dashboard del líder: contador diario** | P2 | "Hoy: X llamadas · Y min" por agente + "llamadas sin duración" (accountability). (Plan §1.5 nudge ③/⑤, Fase 3) |
| 6 | **Export Excel de métricas por campaña** | P3 | Aprovecha `excel.service.js` ya existente. (Plan §5.4, Fase 4) |
| 7 | **Motivo de no interés / origen del lead** | P3 | Columna `motivo` en gestiones con resultado `no_interesado`/`descalificado`. (Plan §4) |
| ~~8~~ | ~~**Mostrar el `resultado` de la llamada en el historial**~~ | ~~P3~~ | ✅ **Completado (18/08/2026):** badge con emoji + label legible en historial de campaña, por solicitud y en páginas de Solicitudes. Ver `feature-historial-campana.md` §4. |
| 9 | **Migración de hosting Render → Hetzner + Coolify** | ⚠️ | Plan completo en [`MIGRACION_HOSPEDAJE.md`](MIGRACION_HOSPEDAJE.md). La app sigue en Render (`archivox.onrender.com`) — **confirmar si ya se ejecutó**. |
| 10 | **Restaurar popup de llamada si la página recarga** | Opcional | Persistir "llamada en curso" en `sessionStorage` (Plan §8.3, v2.1). |

---

## 4. 📚 Inventario completo de `docs/` (estado por archivo)

### ✅ Implementado / Completado

| Documento | Qué es |
|---|---|
| `feature-admin-campanas-sistema.md` | Campañas "Asignadas por el sistema" |
| `feature-admin-solicitudes-globales.md` | Solicitudes globales SuperAdmin |
| `feature-backup-dump-superadmin.md` | Backup de BD con un clic |
| `feature-buscador-global-campanas.md` | Búsqueda global en todas las campañas |
| `feature-buscador-inline-campanas-movil.md` | Buscador inline Campañas móvil |
| `feature-calendario-recordatorios.md` | Calendario de recordatorios |
| `feature-catalogos-globales-nueva-solicitud.md` | Catálogos globales |
| `feature-cedula-tarjeta-movil-solicitudes.md` | Cédula en tarjeta móvil |
| `feature-columna-vendedor-solicitudes.md` | Columna vendedor en solicitudes |
| `feature-excel-demo-video.md` | Excel demo para video |
| `feature-filtros-buscador-movil-solicitudes.md` | Vista móvil Solicitudes v2 |
| `feature-filtros-fecha-todos-solicitudes.md` | Filtros de fecha para todos |
| `feature-filtros-movil-solicitudes.md` | Rediseño filtros móvil |
| `feature-grid-campanas-landing.md` | Landing de campañas |
| `feature-guia-clasificacion-campanas.md` | Guía didáctica de clasificación |
| `feature-header-filtros-solicitudes-desktop.md` | Header + filtros desktop |
| `feature-historial-campana.md` | Historial general de campaña |
| `feature-limite-texto-seguimiento-tarjetas.md` | Límite de texto en tarjetas |
| `feature-login-movil-compacto.md` | Login móvil compacto |
| `feature-no-aplica-credito.md` | Flag "Ya no aplica para crédito" |
| `feature-panel-lateral-agentes.md` | Panel lateral de agentes |
| `feature-panel-lateral-solicitudes.md` | Panel lateral de solicitudes |
| `feature-plantillas-mensajes.md` | Plantillas de mensajes |
| `feature-prioridad-tiempo-sin-seguimiento.md` | Prioridad por tiempo sin seguimiento |
| `feature-recordatorios-campanas.md` | Recordatorios en campañas |
| `feature-rediseno-equipo-movil.md` | Panel líder móvil rediseñado |
| `feature-rediseno-tarjeta-movil-solicitudes.md` | Tarjeta móvil rediseñada |
| `feature-rediseño-semaforo-campañas.md` | Semáforo v6.1 |
| `feature-semaforo-campana-completada.md` | Campaña completada |
| `feature-tarjeta-solicitudes-escritorio.md` | Tarjeta solicitudes desktop |
| `feature-ux-agregar-campana-solicitudes.md` | UX Agregar a Campaña |
| `feature-ux-comportamiento-campanas.md` | UX de campañas v2.0 |
| `feature-widget-ultimas-gestiones-dashboard.md` | Widget últimas gestiones |
| `fix-500-solicitudes-created_at.md` | Fix 500 admin solicitudes |
| `fix-importacion-proteccion-datos-usuarios.md` | Importación protegida |
| `fix-semaforo-movil-orden-fijo.md` | Semáforo móvil orden fijo |
| `progreso-correccion-sistema.md` | Corrección líderes/equipo (✅) |
| `progreso-simplificacion.md` | Simplificación organizacional (✅) |
| `progreso-multi-equipo.md` | Progreso multi-equipo |
| `migration-accion-modulo-produccion.md` | Migración `accion_modulo` aplicada |
| `convencion-css-solicitudes.md` | Convención CSS vigente |

### ⚠️ Obsoleto
| Documento | Qué es |
|---|---|
| `feature-columna-vendedor-gestiones.md` | **OBSOLETO** — `vendedor` se movió de `gestiones` a `solicitudes` (ver `feature-columna-vendedor-solicitudes.md`) |

### 📄 Informes / Auditorías (referencia, no trabajo pendiente)
| Documento | Qué es |
|---|---|
| `informe-auditoria-produccion-daviddlaa.md` | **Auditoría de producción** (origen del plan de métricas) |
| `informe-arquitectura-multi-equipo.md` | Diseño de arquitectura multi-equipo |
| `informe-auditoria-flujo-multi-equipo.md` | Auditoría flujo multi-equipo |
| `informe-auditoria-rendimiento.md` | Auditoría de rendimiento |
| `informe-auditoria-seguridad.md` | Auditoría de seguridad |
| `informe-correccion-errores-lider-equipos.md` | Corrección líder/equipos |
| `informe-correccion-flujo-seguimiento-campanas.md` | Fix flujo seguimientos |
| `informe-deep-links-arquitectura.md` | Deep links |
| `informe-drawer-movil.md` | Fix drawer móvil |
| `informe-fix-filtros-fecha-solicitudes.md` | Fix filtros de fecha |
| `informe-fix-widgets-dashboard-movil.md` | Fix widgets dashboard móvil |
| `informe-funcional-multiequipo.md` | Informe funcional completo |
| `informe-modelo-datos-multi-equipo.md` | Modelo de datos multi-equipo |
| `informe-optimizacion-arquitectura.md` | Optimización de arquitectura |
| `informe-rate-limit-conexiones.md` | Fix rate limiting + SSE |
| `informe-semaforo-tarjetas-movil.md` | Selector semáforo móvil |
| `informe-tecnico-sesion.md` | Auditoría campañas mobile |
| `informe-armonia-widgets-movil.md` | Armonía widgets móvil |

### 📋 Planes / Pendiente
| Documento | Qué es |
|---|---|
| `plan-metricas-llamadas-semaforo.md` | **Plan de métricas** — Fase 1 ✅, Fases 2–4 📋 (ver sección 3) |
| `MIGRACION_HOSPEDAJE.md` | Plan de migración de hosting — sin confirmar ejecución |

### 🗄️ Histórico
- `docs/anteriores/` — documentación histórica (análisis y progresos previos). No refleja el estado actual.

---

## 5. 🔄 Cómo mantener esto al día

- **Cuando termines una tarea pendiente de la sección 3:** muévela a la sección 2 y marca el estado en su documento (banner "Estado: ✅ Implementada").
- **Cuando crees un doc nuevo:** usa el prefijo correcto (`feature-`/`fix-`/`plan-`/`informe-`) y agrégalo al inventario de la sección 4.
- **La sección 3 es la única lista de "por hacer":** si algo pendiente no está ahí, no existe como pendiente.

*Documento de estado del proyecto — actualizado cada vez que cambia el estado de una tarea.*
