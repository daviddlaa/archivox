# Feature: Prioridad por tiempo sin seguimiento en campañas

**Fecha:** Agosto 2026
**Ámbito:** `public/desktop/js/gestion-lote.js`, `public/movil/js/gestion-lote.js`,
`public/css/gestion-lote.css`, `public/movil/css/gestion-lote.css`
**Solicitud:** Al hacer clic en los botones del semáforo (Encaminadas / Seguimiento / En
espera) de una campaña, ordenar las solicitudes por las que llevan más tiempo sin una gestión
(seguimiento), y avisar con un toast que se priorizan las de mayor tiempo sin seguimiento.
Aplica tanto en móvil como en escritorio.

---

## 1. Resumen

Se añadió un **nuevo ordenamiento por antigüedad sin seguimiento** que se activa cuando el
usuario filtra por semáforo (clic en **Encaminadas**, **Seguimiento** o **En espera**) en la
vista de campañas (`gestion-lote`):

1. 🔥 **Destacadas primero** (se conserva la función existente de destacar tarjetas).
2. **Solicitudes sin ninguna gestión** (`fecha_gestion` nula) — son las que más tiempo llevan
   esperando.
3. El resto por **fecha de última gestión más antigua** (mayor tiempo sin seguimiento arriba).

Sin filtro de semáforo activo (vista "Todos"), se mantiene el orden actual por prioridad de
semáforo (amarillo → sin clasificar → verde → rojo).

Además:

- **Toast informativo** al aplicar el filtro: *"✓ ⏱️ Priorizadas: las solicitudes con más
  tiempo sin seguimiento"* (reutiliza los toasts existentes `.campana-toast` / `.campana-toast-mobile`).
- **Badge de tiempo** en cada tarjeta activa: muestra `⏱️ Sin gestión` en rojo para las
  que nunca se gestionaron, y para el resto un **rango psicológico de urgencia escalonada**
  en vez del conteo exacto (ver §2.4), visible siempre para identificar la prioridad de un
  vistazo.

---

## 2. Detalle de la implementación

### 2.1 Ordenamiento (móvil y escritorio)

En `renderizarSolicitudes` de ambos archivos, la función de comparación ahora ramifica según
haya filtro de semáforo activo:

```js
activas.sort(function(a, b) {
    if (a.destacado == 1 && b.destacado != 1) return -1;
    if (a.destacado != 1 && b.destacado == 1) return 1;
    if (filtroSemaforo) {                                  // ← solo con filtro activo
        return antiguedadSinSeguimiento(a) - antiguedadSinSeguimiento(b);
    }
    var pa = PRIORIDAD_SEMAFORO[normalizarSemaforo(a.semaforo)] || 4;
    var pb = PRIORIDAD_SEMAFORO[normalizarSemaforo(b.semaforo)] || 4;
    return pa - pb;
});
```

Helpers nuevos (duplicados por plataforma con sufijo `Movil`):

- `antiguedadSinSeguimiento(sol)` → `0` si no hay `fecha_gestion` (prioridad máxima); en caso
  contrario el timestamp de la fecha de la última gestión (menor = más antiguo = primero).
- `textoTiempoSinSeguimiento(sol)` → `"Sin gestiones"` o uno de los rangos psicológicos
  de §2.4 (mismo sistema que móvil, solo cambia el parser de fecha).

### 2.2 Toast al filtrar

- Escritorio: `setFiltroSemaforo(valor)` → `mostrarConfirmacionGestion(...)` cuando `filtroSemaforo` queda activo.
- Móvil: `setFiltroSemaforoMovil(valor)` → `mostrarConfirmacionGestionMovil(...)` cuando `filtroSemaforoMovil` queda activo.
- El toast **no** se muestra al limpiar el filtro (segundo clic o botón "Ver todas").

### 2.3 Badge de tiempo en la tarjeta

- Escritorio: dentro de `.sol-header-left`, después del badge de estado
  (`html += '<span class="sol-tiempo-badge ...">⏱️ ...'`).
- Móvil: dentro de `.sol-header-badges`, después del badge de segmento.
- Clase extra `sin-gestion` cuando `fecha_gestion` es nula (fondo rojo suave).

### 2.4 Badge psicológico — rangos de urgencia escalonada

El badge no muestra el conteo exacto; usa **rangos psicológicos** para generar sensación
de urgencia sin abrumar con números (misma tabla en móvil y escritorio).

**Versión corta visible en el badge** (Agosto 2026): para que el badge no desborde el
header de la tarjeta en pantallas pequeñas, el texto visible es corto y el **tooltip
(`title`)** conserva la descripción completa. La función corta deriva de la completa por
diccionario (`textoTiempoSinSeguimientoCorto[Movil]` → `textoTiempoSinSeguimiento[Movil]`):

| Tiempo real | Texto visible (corto) | Tooltip (completo) |
|-------------|----------------------|--------------------|
| Sin `fecha_gestion` | `Sin gestión` (rojo) | `Sin gestiones` |
| Menos de 1 minuto | `Recién` | `Recién gestionada` |
| Menos de 1 hora | `~1 h` | `Menos de una hora sin seguimiento` |
| Menos de 24 h | `Hoy` | `Hoy mismo` |
| 1 día | `Ayer` | `Desde ayer` |
| 2 días | `Anteayer` | `Anteayer` |
| 3–6 días | `Esta semana` | `Menos de una semana sin seguimiento` |
| 7–14 días | `Sin gestión 1 sem` | `Más de una semana sin seguimiento` |
| 15–29 días | `Sin gestión 15 días` | `Más de quince días sin seguimiento` |
| 30–59 días | `Sin gestión 1 mes` | `Más de un mes sin seguimiento` |
| 60+ días | `Sin gestión 2 meses` | `Más de dos meses sin seguimiento` |

**Ajuste de texto (Agosto 2026):** los rangos `+1 semana`, `+15 días`, `+1 mes` y
`+2 meses` resultaban crípticos (el `+` no dejaba claro el significado). Ahora el badge
aclara explícitamente que es **tiempo sin gestión**: `Sin gestión 1 sem`, `Sin gestión 15 días`,
`Sin gestión 1 mes`, `Sin gestión 2 meses`; y `Sin gestiones` pasa a `Sin gestión`. Los textos
amigables de gestión reciente (`Recién`, `~1 h`, `Hoy`, `Ayer`, `Anteayer`, `Esta semana`)
se conservan tal cual.

**Badge de destacar solo icono (móvil, Agosto 2026):** en móvil el badge de destacar
muestra solo el fuego `🔥` (28×28 circular): dorado y animado si está destacado, gris
apagado si no. El significado completo se conserva en `title` y `aria-label`. Escritorio
conserva el texto `🔥 Destacada` / `🔥 Destacar`.

### 2.5 CSS

| Archivo | Selector | Estilo |
|---------|----------|--------|
| `public/css/gestion-lote.css` | `.sol-tiempo-badge` | píldora ámbar (`#fef9c3` / `#854d0e`, borde `#fde68a`) |
| `public/css/gestion-lote.css` | `.sol-tiempo-badge.sin-gestion` | rojo suave (`#fee2e2` / `#991b1b`, borde `#fecaca`), mayor peso |
| `public/movil/css/gestion-lote.css` | `.sol-tiempo-badge` | igual pero compacto (max-width 240px, elipsis) |
| `public/movil/css/gestion-lote.css` | `.sol-tiempo-badge.sin-gestion` | rojo suave, peso 800 |

---

## 3. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| API `/api/gestiones-maestro/:id` (ya devolvía `fecha_gestion` por solicitud) | Sin cambios |
| Orden de la lista sin filtro (prioridad de semáforo) | Sin cambios |
| Carrusel del semáforo móvil (orden fijo) | Sin cambios |
| Funciones de toast existentes | Reutilizadas, sin cambios |
| Sección de solicitudes completadas (orden por fecha desc) | Sin cambios |

---

## Verificación

- ✅ `node --check` en `public/desktop/js/gestion-lote.js` y `public/movil/js/gestion-lote.js`.
- ✅ Presentes: `antiguedadSinSeguimiento(Movil)`, `textoTiempoSinSeguimiento(Movil)`,
  `.sol-tiempo-badge` y el toast de priorización en ambos archivos.
- ⏳ Prueba visual: abrir una campaña, filtrar por "Seguimiento" / "Encaminadas" / "En espera"
  y confirmar el orden (sin gestiones primero, luego las más antiguas) + toast + badge.

## Documentación relacionada

- `docs/README.md` — estructura del proyecto (§12.6 Campañas v2).
- `docs/feature-ux-comportamiento-campanas.md` — UX de progreso y recomendaciones.
- `docs/fix-semaforo-movil-orden-fijo.md` — orden fijo del semáforo móvil.
- `README.md` — tabla de Features Recientes.
