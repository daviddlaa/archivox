# 📊 PROGRESO - Implementación Flujo Multi-Equipo

> **Proyecto:** Archivox v3.0
> **Fecha inicio:** Julio 2026
> **Basado en:** `docs/informe-auditoria-flujo-multi-equipo.md`

---

## FASE 1: 🏗️ Asignar `equipo_id` al Crear Campaña
**Archivo:** `src/controllers/gestionesMaestro.controller.js`
- [x] Modificar `createGestionMaestro()` para incluir `equipo_id` desde la sesión
- **Dependencias:** Ninguna
- **Estado:** ✅ COMPLETADO

---

## FASE 2: 👁️ Filtrar Campañas por Equipo en Listado
**Archivo:** `src/controllers/gestionesMaestro.controller.js`
- [x] Modificar `getGestionesMaestro()` para líder vea campañas de su equipo
- [x] Modificar `getGestionMaestroById()` para líder acceda a campañas del equipo
- [x] Modificar `updateGestionMaestro()` para líder actualice campañas del equipo
- [x] Modificar `deleteGestionMaestro()` para líder elimine campañas del equipo
- [x] Modificar `obtenerProgresoGestion()` para líder vea progreso del equipo
- [x] Modificar `agregarSolicitudesACampana()` para líder pueda agregar solicitudes
- [x] Modificar `quitarSolicitudDeCampana()` para líder pueda quitar solicitudes
- **Helper:** `buildGestionAccessWhere()` creado para reutilizar lógica de acceso
- **Dependencias:** Fase 1
- **Estado:** ✅ COMPLETADO

---

## FASE 3: 📋 Mostrar Campañas del Equipo al Líder (en equipo.js)
- [x] Mejorar la tabla de campañas para mostrar asignación a agente (columna "Asignado a")
- [x] Mostrar columnas adicionales (asignado_username desde backend)
- **Dependencias:** Fase 2, 4
- **Estado:** ✅ COMPLETADO

---

## FASE 4: 🔗 Asignar Campañas a Agentes
**Backend:**
- [x] Agregar migración: columna `asignado_a` en `gestiones_maestro`
- [x] Crear endpoint `PUT /api/gestiones-maestro/:id/asignar-agente`
- [x] Crear endpoint `PUT /api/gestiones-maestro/:id/quitar-asignacion`
- [x] Validar líder del equipo
- [x] Validar agente del mismo equipo

**Frontend:**
- [x] Botón "Asignar a agente" en sidebar de campañas (gestion-lote.js)
- [x] Modal con lista de agentes del equipo
- [x] Opción para quitar asignación
- **Dependencias:** Fase 1
- **Estado:** ✅ COMPLETADO

---

## FASE 5: 🎯 Visibilidad del Agente
**Archivo:** `src/controllers/gestionesMaestro.controller.js`
- [x] Modificar listado para que agente vea campañas propias + asignadas (en `buildGestionAccessWhere`)
- [x] Modificar detalle para que agente vea campañas asignadas
- **Dependencias:** Fase 4
- **Estado:** ✅ COMPLETADO

---

## FASE 6: 📊 Dashboard de Equipo Enriquecido
**Archivos:** `src/controllers/equipos.controller.js`, `public/desktop/js/equipo.js`
- [x] Mostrar agente asignado en tabla de campañas del equipo
- [x] Mostrar creador + asignado a en columnas separadas
- [ ] Progreso individual por agente (mejora futura)
- [ ] Totales consolidados del equipo (mejora futura)
- **Dependencias:** Fases 1-5
- **Estado:** ✅ COMPLETADO (parcial)

---

## 🔄 NOTAS Y OBSERVACIONES

- El helper `buildGestionAccessWhere()` maneja 4 casos:
  1. **SuperAdmin/Admin:** Ven TODAS las campañas
  2. **Líder:** Ve campañas propias + campañas de su equipo
  3. **Agente:** Ve campañas propias + campañas asignadas a él
  4. **User legacy:** Solo ve campañas propias (comportamiento original)

- **BUG CRÍTICO CORREGIDO:** La lógica original combinaba condiciones con OR en lugar de AND. Se corrigió usando `buildGestionSQL()` que separa la verificación de ID (`gm.id = X`) de los permisos (`usuario_id = Y OR equipo_id = Z`), combinándolos con AND para evitar accesos incorrectos.

- **Nuevos endpoints creados:**
  - `PUT /api/gestiones-maestro/:id/asignar-agente` → Asigna campaña a agente
  - `PUT /api/gestiones-maestro/:id/quitar-asignacion` → Quita asignación

- **Nueva migración:** `migrations/004_add_asignado_a_columna.js` → Agrega columna `asignado_a` a `gestiones_maestro`
