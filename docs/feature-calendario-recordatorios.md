# Feature: Calendario inteligente de recordatorios (mes + lista del día)

**Fecha:** Agosto 2026  
**Ámbito:**  
- Backend: `gestionesMaestro.controller.js` (`listarRecordatorios`), `gestionesMaestro.routes.js`  
- Frontend: `public/desktop/calendario-recordatorios.html`, `public/movil/calendario-recordatorios.html`,  
  `public/desktop/js/calendario-recordatorios.js`, `public/css/calendario-recordatorios.css`,  
  `public/movil/css/calendario-recordatorios.css`  
- Nav: `app.js`, `public/js/drawer.js`, `public/js/deep-link-router.js`  
**Estado:** Implementado (v1)

## Resumen

Pantalla dedicada para ver gestiones tipo **recordatorio** en un **calendario mensual**. Al seleccionar un día se muestra la lista con secciones Vencidos / Hoy / Del día. Acciones: Hecho, Posponer, Cancelar, Ir a campaña.

## “Inteligente” en v1

- Conteos por día en el grid (puntos por canal / vencidos).
- KPIs del mes: vencidos, hoy, próximos.
- Secciones en la lista del día.
- Scope de acceso = campañas visibles (`buildGestionAccessWhere`).
- Sin librería externa de calendario.

## API

`GET /api/gestiones-maestro/recordatorios?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=pendiente|hecho|cancelado|todos`

Debe ir **antes** de `/:id` en las rutas.

Reutiliza:

- `PUT /api/gestiones-maestro/:id/recordatorios/:rid/estado`
- `PUT /api/gestiones-maestro/:id/recordatorios/:rid/posponer`

## Rutas de página

- Desktop: `/calendario-recordatorios`
- Móvil: `/m/calendario-recordatorios`
- Menú drawer: ⏰ Recordatorios
- Deep link módulo: `calendario-recordatorios`

## Criterios de prueba

1. Abrir calendario desde el menú (desktop y móvil).
2. Ver puntos en días con recordatorios.
3. Click día → lista con acciones.
4. Hecho / posponer / cancelar actualizan el mes.
5. “Ir a campaña” abre la campaña (y card si hay solicitud).
6. Líder/agente solo ven recordatorios de campañas accesibles.

## Relacionado

- `docs/feature-recordatorios-campanas.md` (creación, badge, scheduler).
