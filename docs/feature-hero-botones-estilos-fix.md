# Feature: Fix estilos botones hero en gestión por lote (desktop)

> **Estado:** ✅ Implementada
> **Fecha:** 26/08/2026
> **Ámbito:** Escritorio — `public/desktop/gestion-lote.html`, `public/css/gestion-lote.css`

---

## 1. Problema

Los botones del header en gestión por lote desktop (selector de Campañas 📋, botón Estado 📊, y menú ⋯) no cogían los estilos de la página. Se veían sin fondo, sin padding, sin hover — como botones "raw".

### Causa raíz

En `base.css` los estilos de `.btn-header` están anidados bajo `.page-header-right`:

```css
.page-header-right .btn-header { ... }
.page-header-right .btn-header-primary { ... }
.page-header-right .btn-header-secondary { ... }
```

Pero en `gestion-lote.html` el contenedor se llama `.hero-right`, no `.page-header-right`. Los selectores no coinciden → los estilos no se aplican.

## 2. Solución

Se agregaron reglas equivalentes en `public/css/gestion-lote.css` scoped bajo `.hero-right`:

```css
.hero-right .btn-header { ... }
.hero-right .btn-header-primary { ... }
.hero-right .btn-header-secondary { ... }
.hero-right .btn-header-success { ... }
```

Mismos valores que `base.css` + `white-space: nowrap` para evitar que el texto se rompa.

## 3. Archivos modificados

| Archivo | Cambio |
|---|---|
| `public/css/gestion-lote.css` | Agregados estilos `.hero-right .btn-header*` después de `.hero-right` |

## 4. Notas

- El fix es específico de gestión por lote porque es la única página desktop que usa `.hero-right` en lugar de `.page-header-right`.
- Otras páginas (solicitudes, historial, etc.) usan `.page-header-right` y ya tenían los estilos de `base.css`.
