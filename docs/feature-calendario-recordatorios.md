# Feature: Calendario inteligente de recordatorios (mes + lista del día)

**Fecha:** Agosto 2026  
**Ámbito:**  
- Backend: `gestionesMaestro.controller.js` (`listarRecordatorios`), `gestionesMaestro.routes.js`  
- Frontend: `public/desktop/calendario-recordatorios.html`, `public/movil/calendario-recordatorios.html`,  
  `public/desktop/js/calendario-recordatorios.js`, `public/css/calendario-recordatorios.css`,  
  `public/movil/css/calendario-recordatorios.css`  
- Nav: `app.js`, `public/js/drawer.js`, `public/js/deep-link-router.js`  
**Estado:** Implementado (v2)

## Resumen

Pantalla dedicada para ver gestiones tipo **recordatorio** en un **calendario mensual**. Al seleccionar un día se muestra la lista con secciones Vencidos / Hoy / Del día. Acciones: Hecho, Posponer, Cancelar, Ir a campaña.

## v2 — Mejoras de UX (Agosto 2026)

Se eliminaron los diálogos nativos (`prompt()`/`alert()`) y se pulió la interacción en ambas
plataformas:

| Mejora | Detalle | Plataforma |
|--------|---------|------------|
| **Modal de posponer** ⭐ | `abrirModalPosponerCal()` + `guardarPosponerCal()`: reemplaza al `prompt()` nativo. Atajos **+30 min / +1 hora / +1 día** + campo `datetime-local` precargado con la fecha/hora actual del recordatorio | Desktop + móvil |
| **Toast** | `cal-toast` reemplaza a `alert()`: "✅ Marcado como hecho", "⏰ Recordatorio reprogramado" y errores suaves | Ambas |
| **Auto-scroll al día (móvil)** | Al tocar un día, la lista hace `scrollIntoView({behavior:'smooth'})` hasta el panel del día | Móvil |
| **Swipe de mes (móvil)** | `configurarSwipeMes()`: deslizar horizontal sobre el calendario cambia de mes (umbral 70px; `touch-action: pan-y` para no bloquear el scroll vertical) | Móvil |
| **Badge 📅 Hoy** | `cal-dia-hoy-badge` en el panel del día cuando corresponde a hoy | Ambas |
| **Hover desktop** | Tarjetas de recordatorio con elevación suave al pasar el mouse | Desktop |

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

## Criterios de prueba (v2)

1. Abrir calendario desde el menú (desktop y móvil).
2. Ver puntos en días con recordatorios.
3. Click día → lista con acciones.
4. Hecho / posponer / cancelar actualizan el mes.
5. “Ir a campaña” abre la campaña (y card si hay solicitud).
6. Líder/agente solo ven recordatorios de campañas accesibles.

## Relacionado

- `docs/feature-recordatorios-campanas.md` (creación, badge, scheduler).
