# 📋 INFORME TÉCNICO — Auditoría y Reparación del Drawer Móvil

**Versión:** 1.0.0  
**Fecha:** Julio 2026  
**Componente:** Sistema Drawer Unificado — Versión Móvil  
**Precedido por:** Estandarización del sistema Drawer (Fase previa)

---

## 📑 Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Problema Reportado](#2-problema-reportado)
3. [Metodología de Auditoría](#3-metodología-de-auditoría)
4. [Comparativa Desktop vs Mobile](#4-comparativa-desktop-vs-mobile)
5. [Causa Raíz](#5-causa-raíz)
6. [Archivos Analizados](#6-archivos-analizados)
7. [Archivos Modificados](#7-archivos-modificados)
8. [Cambios Realizados](#8-cambios-realizados)
9. [Antes vs Después](#9-antes-vs-después)
10. [Riesgos](#10-riesgos)
11. [Verificación](#11-verificación)
12. [Compatibilidad](#12-compatibilidad)
13. [Lecciones Aprendidas](#13-lecciones-aprendidas)

---

## 1. Resumen Ejecutivo

Se realizó una auditoría completa del sistema Drawer en la versión móvil tras reportarse dos problemas: (1) el Drawer aparecía con jerarquía visual incorrecta respecto al footer, y (2) el botón hamburguesa no abría el Drawer.

**Hallazgo:** Dos causas raíz independientes:

| # | Causa | Tipo | Gravedad |
|---|-------|------|----------|
| 1 | **Falta importación de `drawer.css`** en los 8 archivos HTML móviles | CSS faltante | 🔴 Crítica |
| 2 | **Conflicto de z-index**: `.nav-bottom` (1004) > `.drawer` (1003) | CSS conflicto | 🟡 Media |

**Solución:** 9 archivos modificados — 1 cambio en CSS (z-index) + 8 adiciones de import en HTML.

---

## 2. Problema Reportado

### Síntomas

1. **El Drawer aparece por encima del footer o con jerarquía visual incorrecta**  
   - El footer (nav-bottom) se dibuja encima del panel del drawer
   - El overlay no oscurece correctamente el footer

2. **El botón hamburguesa no abre el Drawer**  
   - Al hacer clic en "Menú" (☰) no ocurre ningún cambio visual
   - `Drawer.toggle()` se ejecuta pero no hay animación ni transición

### Impacto

- Funcionalidad de navegación principal del móvil completamente rota
- Usuarios no pueden acceder al menú de navegación desde dispositivos móviles

---

## 3. Metodología de Auditoría

La auditoría se realizó siguiendo un proceso sistemático:

```
1. Recopilación → 2. Comparación → 3. Análisis → 4. Diagnóstico → 5. Implementación → 6. Verificación
```

### Archivos revisados por categoría

| Tipo | Desktop | Mobile | Global/Compartido |
|------|---------|--------|-------------------|
| **HTML** | `public/desktop/index.html` + 8 páginas | `public/movil/index.html` + 8 páginas | `public/index.html` (legacy) |
| **CSS** | `public/desktop/css/base.css` + 8 CSS | `public/movil/css/estilos.css` + 3 CSS | `public/css/drawer.css`, `notificaciones.css` |
| **JS** | `public/desktop/js/dashboard.js` + 7 JS | `public/movil/js/dashboard.js` + 7 JS | `public/js/drawer.js`, `notificaciones-dashboard.js` |

### Verificaciones realizadas

- [x] IDs y clases HTML
- [x] Selectores CSS
- [x] Imports CSS en `<head>`
- [x] Imports JS al final del `<body>`
- [x] Orden de carga
- [x] Eventos y listeners
- [x] z-index y contextos de apilamiento
- [x] `position`, `overflow`, `transform`
- [x] Media queries
- [x] API `window.Drawer`
- [x] Inicialización en `DOMContentLoaded`

---

## 4. Comparativa Desktop vs Mobile

### 4.1 Imports CSS

| Archivo | `drawer.css` | `notificaciones.css` |
|---------|:-----------:|:--------------------:|
| **Desktop** `index.html` | ✅ `href="/css/drawer.css"` | ✅ |
| **Desktop** `solicitudes.html` | ✅ *(confirmado)* | ✅ |
| **Mobile** `index.html` | ❌ **FALTANTE** | ✅ |
| **Mobile** `historial.html` | ❌ **FALTANTE** | ❌ |
| **Mobile** `gestiones.html` | ❌ **FALTANTE** | ❌ |
| **Mobile** `ventas.html` | ❌ **FALTANTE** | ❌ |
| **Mobile** `solicitudes.html` | ❌ **FALTANTE** | ✅ |
| **Mobile** `importar.html` | ❌ **FALTANTE** | ❌ |
| **Mobile** `relaciones.html` | ❌ **FALTANTE** | ❌ |
| **Mobile** `gestion-lote.html` | ❌ **FALTANTE** | ❌ |

### 4.2 Imports JS

| Archivo | `drawer.js` | `notificaciones-dashboard.js` |
|---------|:----------:|:----------------------------:|
| **Desktop** `index.html` | ✅ (último) | ✅ |
| **Desktop** `solicitudes.html` | ✅ | ✅ |
| **Mobile** `index.html` | ✅ (2º de 3) | ✅ |
| **Mobile** `solicitudes.html` | ✅ (3º de 4) | ✅ |
| **Mobile** `historial.html` | ✅ (único) | ❌ |
| **Mobile** `gestiones.html` | ✅ (1º de 2) | ❌ |
| **Mobile** `ventas.html` | ✅ (1º de 2) | ❌ |
| **Mobile** `importar.html` | ✅ (1º de 2) | ❌ |
| **Mobile** `relaciones.html` | ✅ (1º de 2) | ❌ |
| **Mobile** `gestion-lote.html` | ✅ (1º de 2) | ❌ |

> **Conclusión:** Todos los HTML móviles cargan `drawer.js` correctamente, pero NINGUNO carga `drawer.css`.

### 4.3 Estructura HTML — Drawer Wrapper

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| `<div id="drawer-wrapper">` | ✅ Explícito en HTML | ❌ No existe (JS lo crea) |

> **Nota:** `drawer.js` maneja esta diferencia correctamente mediante:
> ```javascript
> var wrapper = document.getElementById('drawer-wrapper');
> if (!wrapper) {
>     wrapper = document.createElement('div');
>     wrapper.id = 'drawer-wrapper';
>     document.body.insertBefore(wrapper, document.body.firstChild);
> }
> ```

### 4.4 Botón Hamburguesa

| Aspecto | Desktop | Mobile |
|---------|---------|--------|
| **Tipo de elemento** | `<button id="drawer-toggle">` (JS crea) | `<a href="#" onclick="Drawer.toggle()">` |
| **Ubicación** | Flotante (fixed, top-right) | En nav-bottom (Menú) |
| **Mecanismo** | `onclick="Drawer.toggle()"` | `onclick="Drawer.toggle(); return false;"` |
| **Excepción** | — | `importar.html` usa `<button class="btn-menu" onclick="Drawer.toggle()">` |

> **Conclusión:** El mecanismo de toggle es consistente y funcional. El problema no está en el JS ni en los listeners.

### 4.5 Contexto de Apilamiento (z-index)

| Elemento | z-index | Archivo |
|----------|:-------:|---------|
| `.drawer-toggle` (botón flotante) | 1002 | `drawer.css` |
| `.drawer-overlay` | 1001 | `drawer.css` |
| `.drawer` (panel) | 1003 | `drawer.css` |
| **`.nav-bottom` (footer móvil)** | **~~1004~~ → 100** ⚡ | **`estilos.css`** |
| `.header` (sticky) | 100 | `estilos.css` |
| `.notif-panel` | 9999 | `notificaciones.css` |
| `.notif-overlay` | 9998 | `notificaciones.css` |

> **Problema:** `.nav-bottom` tenía `z-index: 1004`, superior al drawer (1003) y al overlay (1001).  
> **Solución:** Se redujo a `z-index: 100`, por debajo del overlay del drawer.

---

## 5. Causa Raíz

### 🔴 Causa #1: Falta importación de `drawer.css` en todos los HTML móviles

**¿Qué ocurre sin `drawer.css`?**

| Elemento | Sin CSS | Con CSS |
|----------|---------|---------|
| `.drawer` | Posición `static`, visible en flujo normal | `position: fixed; left: -280px;` (oculto) |
| `.drawer-overlay` | Sin fondo, sin opacidad | `background: rgba(0,0,0,0.5); opacity: 0;` |
| `.drawer.open` | Sin efecto | `left: 0;` (desliza) |
| `.drawer-overlay.open` | Sin efecto | `opacity: 1;` (visible) |
| Transiciones | Sin animación | `transition: left 0.3s ease;` |

**¿Desde cuándo?**  
Desde la estandarización del sistema Drawer. Se agregó `drawer.css` a Desktop y Admin, pero se omitió en todos los HTML móviles.

**¿Por qué Desktop no falla?**  
Porque `public/desktop/index.html` sí incluye:
```html
<link rel="stylesheet" href="/css/drawer.css">
```

### 🔴 Causa #2: Conflicto de z-index (nav-bottom vs drawer)

**¿Qué ocurría?**  
`.nav-bottom` en `estilos.css` tenía `z-index: 1004`, mientras que `.drawer` en `drawer.css` tenía `z-index: 1003`. El footer se dibujaba encima del drawer.

**¿Por qué Desktop no falla?**  
Desktop no tiene `.nav-bottom` (se oculta con `@media (min-width: 769px) { .nav-bottom { display: none; } }`).

---

## 6. Archivos Analizados

### HTML (16 archivos)

| Archivo | Estado |
|---------|--------|
| `public/desktop/index.html` | Referencia (funciona correctamente) |
| `public/desktop/login.html` | Referencia |
| `public/desktop/gestiones.html` | Referencia |
| `public/desktop/solicitudes.html` | Referencia |
| `public/desktop/ventas.html` | Referencia |
| `public/desktop/historial.html` | Referencia |
| `public/desktop/importar.html` | Referencia |
| `public/desktop/relaciones.html` | Referencia |
| `public/desktop/gestion-lote.html` | Referencia |
| `public/movil/index.html` | **Modificado** |
| `public/movil/historial.html` | **Modificado** |
| `public/movil/gestiones.html` | **Modificado** |
| `public/movil/ventas.html` | **Modificado** |
| `public/movil/solicitudes.html` | **Modificado** |
| `public/movil/importar.html` | **Modificado** |
| `public/movil/relaciones.html` | **Modificado** |
| `public/movil/gestion-lote.html` | **Modificado** |
| `public/movil/login.html` | Sin drawer (no requiere cambios) |

### CSS (6 archivos)

| Archivo | Estado |
|---------|--------|
| `public/css/drawer.css` | Sin cambios (ya correcto) |
| `public/css/notificaciones.css` | Sin cambios |
| `public/css/main.css` | Sin cambios |
| `public/css/solicitudes.css` | Sin cambios |
| `public/movil/css/estilos.css` | **Modificado** (z-index) |
| `public/desktop/css/base.css` | Sin cambios |

### JS (3 archivos)

| Archivo | Estado |
|---------|--------|
| `public/js/drawer.js` | Sin cambios (ya correcto) |
| `public/js/notificaciones-dashboard.js` | Sin cambios |
| `public/movil/js/dashboard.js` | Sin cambios |

---

## 7. Archivos Modificados

**Total: 9 archivos**

| # | Archivo | Cambio | Tipo |
|---|---------|--------|------|
| 1 | `public/movil/css/estilos.css` | `.nav-bottom { z-index: 1004 → 100 }` | 🛠️ CSS |
| 2 | `public/movil/index.html` | `+ <link rel="stylesheet" href="/css/drawer.css">` | ➕ Import |
| 3 | `public/movil/historial.html` | `+ <link rel="stylesheet" href="/css/drawer.css">` | ➕ Import |
| 4 | `public/movil/gestiones.html` | `+ <link rel="stylesheet" href="/css/drawer.css">` | ➕ Import |
| 5 | `public/movil/ventas.html` | `+ <link rel="stylesheet" href="/css/drawer.css">` | ➕ Import |
| 6 | `public/movil/solicitudes.html` | `+ <link rel="stylesheet" href="/css/drawer.css">` | ➕ Import |
| 7 | `public/movil/importar.html` | `+ <link rel="stylesheet" href="/css/drawer.css">` | ➕ Import |
| 8 | `public/movil/relaciones.html` | `+ <link rel="stylesheet" href="/css/drawer.css">` | ➕ Import |
| 9 | `public/movil/gestion-lote.html` | `+ <link rel="stylesheet" href="/css/drawer.css">` | ➕ Import |

---

## 8. Cambios Realizados

### Cambio 1 — z-index del nav-bottom

**Archivo:** `public/movil/css/estilos.css`

```diff
 .nav-bottom {
     position: fixed;
     bottom: 0;
     left: 0;
     right: 0;
     height: 65px;
     background: white;
     display: flex;
     justify-content: space-around;
     align-items: center;
     padding: 6px 8px;
     box-shadow: 0 -2px 16px rgba(0,0,0,0.08);
-    z-index: 1004;
+    z-index: 100;
     border-top: 1px solid #f0f0f0;
     padding-bottom: max(6px, env(safe-area-inset-bottom, 6px));
 }
```

**Justificación:** El valor `100` está por debajo del overlay del drawer (`1001`) y del panel del drawer (`1003`), pero por encima del contenido normal de la página. Cuando el drawer se abre, el overlay oscurece correctamente el nav-bottom.

### Cambio 2 — Import de drawer.css en HTML móviles

**Patrón aplicado en los 8 archivos:**

```diff
 <link rel="stylesheet" href="/movil/css/estilos.css">
+<link rel="stylesheet" href="/css/drawer.css">
```

**Orden de carga CSS resultante:**
1. `estilos.css` — Base móvil (variables, reset, nav-bottom, header, cards)
2. `drawer.css` — Drawer estandarizado (overlay, panel, menú, animaciones) 🆕
3. CSS específico de la página (ej: `gestiones.css`, `importar.css`, inline `<style>`)
4. `notificaciones.css` — Notificaciones (solo en páginas que las usan)

---

## 9. Antes vs Después

### 9.1 Visual — Drawer cerrado

| Estado | Drawer | Footer |
|--------|--------|--------|
| **Antes** | Visible como HTML sin estilos en medio de la página | Normal |
| **Después** | Oculto (off-screen, `left: -280px`) | Normal |

### 9.2 Visual — Drawer abierto

| Estado | Drawer | Footer | Overlay |
|--------|--------|--------|---------|
| **Antes** | Sin animación, visible en flujo | Se dibuja encima del drawer | Invisible |
| **Después** | Se desliza desde la izquierda con animación | Queda debajo del overlay | Oscurece toda la pantalla |

### 9.3 Comportamiento — Botón "Menú"

| Estado | Click en ☰ | Cerrar |
|--------|-----------|--------|
| **Antes** | `Drawer.toggle()` se ejecuta, sin efecto visual | Sin efecto |
| **Después** | Drawer se abre con animación + overlay | Click en overlay o ✕ cierra |

### 9.4 Stacking Context (z-index)

| Elemento | Antes | Después |
|----------|:-----:|:-------:|
| `.header` (sticky) | 100 | 100 |
| `.nav-bottom` | **1004** ⚠️ | **100** ✅ |
| `.drawer-overlay` | 1001 | 1001 |
| `.drawer-toggle` | 1002 | 1002 |
| `.drawer` | 1003 | 1003 |
| `.notif-panel` | 9999 | 9999 |

---

## 10. Riesgos

### Evaluación de riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|:-----------:|:-------:|------------|
| Romper Desktop | ❌ Nula | Alto | Desktop ya importa drawer.css; no tiene `.nav-bottom` |
| Romper Admin | ❌ Nula | Alto | Admin ya importa drawer.css; admin.css no tiene `.nav-bottom` |
| Romper notificaciones | ❌ Nula | Medio | Notificaciones usan z-index 9998-9999, muy superior |
| Duplicación de estilos | ❌ Nula | Bajo | `drawer.css` no tiene reglas que conflicten con `estilos.css` |
| Carga adicional HTTP | 🟢 Mínimo | Bajo | 1 request extra (~2KB, cacheable por el navegador) |

### Riesgo documentado (no resuelto)

`public/movil/gestion-lote.html` referencia `/movil/css/gestion-lote.css` que **no existe** (404). Esto es un problema preexistente, no relacionado con el drawer. Todos los estilos de esa página están inline en el HTML, por lo que la ausencia del archivo no afecta la funcionalidad, pero genera un 404 en consola.

---

## 11. Verificación

### Procedimiento de verificación

1. **Cargar drawer.css:** Abrir cualquier página móvil y verificar en DevTools (Red/Network) que `/css/drawer.css` se carga con código 200
2. **Abrir Drawer:** Hacer clic en "Menú" (☰) en el nav-bottom inferior
3. **Verificar:**
   - [ ] El drawer se desliza desde la izquierda con animación suave (~300ms)
   - [ ] El overlay oscurece el fondo (incluyendo el nav-bottom inferior)
   - [ ] El botón ✕ cierra el drawer al hacer clic
   - [ ] Clic en el overlay cierra el drawer
   - [ ] Tecla Escape cierra el drawer
   - [ ] El nav-bottom queda debajo del overlay, no encima
4. **Probar en todas las páginas móviles:**
   - `/m` (index)
   - `/m/solicitudes`
   - `/m/historial`
   - `/m/gestiones`
   - `/m/ventas`
   - `/m/importar`
   - `/m/relaciones`
   - `/m/gestion-lote`

### Verificación Desktop (regresión)

1. Abrir `/` (Desktop dashboard)
2. Verificar que el botón flotante ☰ funciona correctamente
3. Verificar que Desktop no muestra el nav-bottom inferior

---

## 12. Compatibilidad

| Módulo | Estado | Explicación |
|--------|:------:|-------------|
| **Desktop** | ✅ | Sin cambios en Desktop. Ya importaba drawer.css. No tiene `.nav-bottom` |
| **Mobile** | ✅ | drawer.css ahora se importa. z-index corregido. Drawer funcional |
| **Admin** | ✅ | Sin cambios en Admin. Ya importaba drawer.css. No tiene `.nav-bottom` |
| **Drawer estandarizado** | ✅ | Se reutiliza el mismo `drawer.js` + `drawer.css` existente sin modificaciones |
| **Sistema notificaciones** | ✅ | `notif-panel` usa z-index 9999, muy superior a todo |
| **Footer (nav-bottom)** | ✅ | Sigue visible con z-index 100 cuando drawer está cerrado. Queda bajo overlay cuando drawer está abierto |
| **Header móvil** | ✅ | Sticky con z-index 100 (mismo nivel que nav-bottom, posiciones distintas) |
| **Responsive** | ✅ | `@media (min-width: 769px)` oculta nav-bottom en desktop |
| **Página legacy** (`public/index.html`) | ✅ | No usa drawer móvil ni nav-bottom |
| **Login** (`public/movil/login.html`) | ✅ | No tiene drawer ni nav-bottom, no requiere cambios |

---

## 13. Lecciones Aprendidas

### Error Humano

La causa raíz fue un **error humano durante la estandarización**: se agregaron los imports de `drawer.css` en Desktop y Admin, pero se omitió por completo la versión móvil.

### Prevención Futura

1. **Checklist de estandarización:** Incluir verificación cruzada Desktop ↔ Mobile ↔ Admin para cualquier cambio en componentes compartidos
2. **Test de regresión visual:** Verificar que todas las versiones (Desktop, Mobile, Admin) rendericen correctamente después de cambios en CSS/JS compartidos
3. **Convención de imports:** Documentar el orden estándar de imports CSS en los HTML:
   ```
   1. Base (estilos.css / base.css)
   2. Drawer (drawer.css) — SIEMPRE
   3. Página específica
   4. Notificaciones (notificaciones.css) — si aplica
   ```

### Datos de la Auditoría

| Métrica | Valor |
|---------|-------|
| Archivos analizados | 16 HTML + 6 CSS + 3 JS = 25 archivos |
| Archivos modificados | 9 |
| Líneas agregadas | 8 (un import por archivo) |
| Líneas modificadas | 1 (z-index) |
| Causas raíz identificadas | 2 (independientes pero concurrentes) |
| Tiempo estimado de reparación | < 5 min (una vez identificadas las causas) |

---

> *Documento generado durante la sesión de auditoría del Drawer Móvil — Julio 2026*
> *Repositorio: ARCHIVOX — Sistema de Gestión de Solicitudes*
