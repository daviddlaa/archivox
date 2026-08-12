# 🆔 Cédula visible en la tarjeta móvil de Solicitudes + nombre siempre en una línea

**Fecha:** Agosto 2026
**Módulo:** Solicitudes (Móvil)
**Archivos modificados:**
- `public/movil/js/solicitudes.js` — `renderizarCards`, bloque FILA 2
- `public/movil/css/solicitudes-mobile.css` — `.card-fila-2`, nuevas `.card-fila-2-nombre` / `.card-fila-2-cedula`

**Backend: sin cambios** (la cédula ya venía en el payload de `/api/excel/solicitudes`).

---

## Problema resuelto

| Problema | Antes | Ahora |
|----------|-------|-------|
| Cédula no visible en la tarjeta | La FILA 2 solo mostraba el nombre (`(item.nombre || 'Sin nombre') + ' 📋'`); la cédula solo existía en el modal de detalle y en el tooltip de copiar | La cédula se muestra **siempre debajo del nombre** con `🆔 + número` |
| Nombre que se partía en 2 líneas | `.card-fila-2` usaba `font-size: 16px` + `word-break: break-word` sin límite de líneas | Letra más pequeña (13.5px) + `white-space: nowrap` + `text-overflow: ellipsis` → **el nombre nunca hace 2 líneas** (se trunca con "…") |

## Cambios

### JS (`public/movil/js/solicitudes.js`)
La FILA 2 ahora renderiza **dos elementos apilados** (el contenedor es `flex-direction: column`):

```html
<div class="card-fila-2" onclick="...copiarNombreCedula(...)" title="Copiar nombre + cédula">
    <span class="card-fila-2-nombre">Nombre del cliente</span>   <!-- UNA línea siempre -->
    <span class="card-fila-2-cedula">🆔 1234567890</span>        <!-- debajo del nombre -->
</div>
```

- El `onclick` de **copiar nombre + cédula** se conserva intacto.
- **Mejora de seguridad adicional:** el nombre ahora se escapa con `escaparParaHTMLMovil` en el HTML visible (antes se inyectaba crudo → riesgo XSS). La cédula también se escapa.
- Si no hay nombre → "Sin nombre"; si no hay cédula → "🆔 Sin cédula".

### CSS (`public/movil/css/solicitudes-mobile.css`)
Siguiendo la **convención CSS del proyecto** (`docs/convencion-css-solicitudes.md`):

- `.card-fila-2` → `display: flex; flex-direction: column; gap: 3px;` (se elimina el `word-break: break-word` y el font-size de 16px).
- `body .card-fila-2-nombre` (nuevo): `font-size: 13.5px; font-weight: 700; color: #111827;` + `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` → garantiza UNA línea.
- `body .card-fila-2-cedula` (nuevo): `font-size: 11.5px; font-weight: 600; color: #6b7280;` + nowrap/ellipsis → una línea, tono secundario.
- Prefijo `body` (especificidad 0,1,1) para ganar al CSS compartido según convención; además el CSS móvil se carga **después** del compartido (`movil/solicitudes.html`: `css/solicitudes.css` → `movil/css/solicitudes-mobile.css`).

## Lo que NO cambió
- Backend, filas 1 (segmento/estado), 3 (botones), 4 (campaña/no aplica) y 5 (producto/fecha/vendedor).
- El render de **desktop** (`public/desktop/js/solicitudes.js` usa su propia `.card-fila-2`; no se tocó).
- Comportamiento de copiar (clic en el bloque).

## Pruebas
1. `node --check public/movil/js/solicitudes.js` ✅
2. Llaves CSS balanceadas (218/218) ✅
3. Nombres largos → truncados con "…" en una línea; cédula debajo en gris.
4. Sin cédula → "🆔 Sin cédula"; sin nombre → "Sin nombre".
