# INFORME TÉCNICO — Auditoría y Corrección del Módulo Campañas Mobile

**Proyecto:** ARCHIVOX  
**Fecha:** 12 de julio de 2026  
**Versión:** 1.0  
**Módulo:** Campañas (Mobile) — `public/movil/gestion-lote.html`

---

## 1. Problemas Encontrados

### Problema 1: Drawer Desktop aparece en Mobile (Causa Raíz)

| Ítem | Descripción |
|---|---|
| **Síntoma** | El panel de navegación lateral (drawer) diseñado para escritorio se renderiza en la versión Mobile, ocupando memoria y creando nodos DOM innecesarios. |
| **Causa Raíz** | `public/js/drawer.js` — La función `buildDrawerHTML()` siempre creaba el HTML completo del drawer (`<div id="drawer-overlay">` + `<aside id="drawer">`) en TODAS las páginas, independientemente de la plataforma. Solo el botón flotante ☰ se ocultaba condicionalmente en mobile. El drawer panel (~40 nodos DOM con enlaces de escritorio) permanecía en el DOM aunque estuviera oculto por CSS (`left: -280px`). |
| **Archivo** | `public/js/drawer.js` |
| **Línea** | Función `buildDrawerHTML()` — siempre renderizaba overlay + drawer |

### Problema 2: Botones Mobile demasiado pequeños

| Ítem | Descripción |
|---|---|
| **Síntoma** | Los botones de acción en las tarjetas de campañas (`btn-sol`) tenían `padding: 8px 10px`, `font-size: 11px`, `min-width: 70px`. Esto está muy por debajo del estándar mínimo de touch targets (44px × 44px recomendado por Apple/Android). |
| **Causa Raíz** | Los estilos `.btn-sol` en `public/movil/gestion-lote.html` estaban diseñados para un uso esporádico, no para una experiencia táctil continua. |
| **Archivo** | `public/movil/gestion-lote.html` — bloque `<style>` |

### Problema 3: Scroll Horizontal de Campañas

| Ítem | Descripción |
|---|---|
| **Síntoma** | El scroll horizontal de campañas existía y funcionaba, pero la presentación visual era básica y carecía de refinamiento. Los chips de campaña tenían padding insuficiente y faltaba feedback visual táctil. |
| **Causa Raíz** | Los estilos originales fueron creados antes de la estandarización del drawer y no recibieron una revisión de UX mobile. |
| **Archivo** | `public/movil/gestion-lote.html` — bloque `<style>` |

---

## 2. Archivos Analizados

| Archivo | Rol |
|---|---|
| `public/js/drawer.js` | Módulo central del drawer — **modificado** |
| `public/movil/css/estilos.css` | Estilos base mobile — **modificado** |
| `public/movil/gestion-lote.html` | Página de Campañas Mobile — **modificado** |
| `public/movil/js/gestion-lote.js` | Lógica de Campañas Mobile — **modificado** |
| `public/css/drawer.css` | Estilos del drawer (no modificado, solo referencia) |
| `public/css/gestion-lote.css` | Estilos desktop de campañas (no modificado) |
| `public/movil/index.html` | Verificación de navegación |
| `public/movil/solicitudes.html` | Verificación de Drawer.toggle() |
| `public/movil/gestiones.html` | Verificación de Drawer.toggle() |
| `public/movil/relaciones.html` | Verificación de Drawer.toggle() |
| `public/movil/ventas.html` | Verificación de Drawer.toggle() |
| `public/movil/historial.html` | Verificación de Drawer.toggle() |
| `public/movil/importar.html` | Verificación de Drawer.toggle() |
| `public/perfil.html` | Verificación de Drawer.toggle() |
| `public/desktop/gestion-lote.html` | Comparación Desktop vs Mobile |

---

## 3. Archivos Modificados

| Archivo | Cambio |
|---|---|
| `public/js/drawer.js` | **REFACTOR COMPLETO**: Separación Desktop/Mobile. En mobile: no se crea HTML del drawer. Se delega a `MobileMenu` (bottom sheet nativo creado bajo demanda). |
| `public/movil/css/estilos.css` | **NUEVOS ESTILOS**: Sistema completo de MobileMenu (`.mm-overlay`, `.mm-sheet`, `.mm-handle`, `.mm-header`, `.mm-body`, `.mm-item`, `.mm-divider`, etc.) |
| `public/movil/gestion-lote.html` | **REDISEÑO COMPLETO**: Nuevos estilos para botones táctiles (min-height: 48px), scroll horizontal mejorado (glassmorphism), progreso, filtros, tarjetas y estados. |
| `public/movil/js/gestion-lote.js` | **ACTUALIZACIÓN**: Clases de botones actualizadas (`.btn-sol-whatsapp`, eliminado `.btn-sol-small`). |

---

## 4. Cambios Realizados

### 4.1 `public/js/drawer.js` — Refactor Desktop/Mobile

**Antes:**
```javascript
function buildDrawerHTML() {
    var mob = isMobile();
    var html = '';
    if (!mob) { html += toggle; }  // toggle solo desktop
    html += overlay;              // SIEMPRE se crea
    html += drawer;               // SIEMPRE se crea (~40 nodos DOM)
}
```

**Después:**
```javascript
// En mobile: NO se llama initDesktopDrawer()
// Se expone MobileMenu con API idéntica (Drawer.open/close/toggle)
// MobileMenu crea HTML solo cuando open() es llamado
// MobileMenu destruye HTML cuando close() es ejecutado
if (isMobile()) {
    window.Drawer = {
        open: function() { MobileMenu.open(); },
        close: function() { MobileMenu.close(); },
        toggle: function() { MobileMenu.toggle(); }
    };
} else {
    // Drawer Desktop completo (inalterado)
    initDesktopDrawer();
}
```

**Cambios específicos:**
- Se eliminó `esRutaMobile()` (no utilizada)
- Se restauró el `resize handler` para ocultar toggle en desktop al redimensionar
- `checkAdminAccess()` verifica `adminLink` (desktop) — separado de `MobileMenu._checkAdmin()` (mobile)
- API pública `Drawer.open/close/toggle` se mantiene 100% compatible

### 4.2 `public/movil/gestion-lote.html` — Rediseño de Botones Mobile

**Antes:**
```css
.btn-sol {
    padding: 8px 10px;
    font-size: 11px;
    min-width: 70px;  /* 70px de ancho mínimo */
}
```

**Después:**
```css
.btn-sol {
    padding: 12px 14px;
    font-size: 13px;
    min-height: 48px;  /* Touch target estándar Apple/Android */
    min-width: 48px;
    border-radius: 12px;
    font-weight: 700;
    letter-spacing: 0.2px;
}
```

**Nuevos botones:**
| Clase | Color | Uso |
|---|---|---|
| `.btn-sol-call` | Verde (`#d1fae5`) | Llamada telefónica (icono 📞) |
| `.btn-sol-primary` | Azul (`#2563eb`) | Seguimiento |
| `.btn-sol-whatsapp` | Verde claro (`#dcfce7`) | WhatsApp Directo |
| `.btn-sol-ver` | Gris (`#6b7280`) | Ver gestión |
| `.btn-sol-historial` | Gris claro (`#e5e7eb`) | Historial |
| `.btn-sol-quitar` | Rojo claro (`#fee2e2`) | Quitar de campaña |

### 4.3 Scroll Horizontal — Mejora Visual

**Antes:** Chips básicos con padding 8px 14px, colores planos.

**Después:**
- Efecto glassmorphism (`backdrop-filter: blur(4px)`)
- Padding aumentado a 10px 48px 10px 16px (espacio para botones de acción)
- Bordes con opacidad (`rgba(255,255,255,0.12)`)
- Sombra inferior para dar profundidad
- Chip activo con glow (`box-shadow: 0 0 20px rgba(99, 102, 241, 0.2)`)
- Animación `scale(0.95)` al presionar

---

## 5. Justificación de Diseño UX

| Decisión | Justificación |
|---|---|
| **MobileMenu como bottom sheet** | Patrón nativo iOS/Android que no compite con el contenido. Se desliza desde abajo y se destruye al cerrar. |
| **min-height: 48px en botones** | Estándar de accesibilidad táctil (Apple HIG: 44px mínimo, Material Design: 48px recomendado). |
| **Backdrop-filter en chips** | Efecto glassmorphism sutil que moderniza la apariencia sin romper la estética de ARCHIVOX. |
| **Animación cubic-bezier nativa iOS** | Curva `cubic-bezier(0.16, 1, 0.3, 1)` = misma curva que iOS Spring. Sensación de fluidez nativa. |
| **Cero memoria residual** | MobileMenu crea y destruye nodos DOM bajo demanda. No hay elementos ocultos con CSS. |
| **API Drawer compatible** | Todas las páginas mobile existentes siguen funcionando sin cambios. |

---

## 6. Antes vs Después

### Drawer Desktop en Mobile

| Antes | Después |
|---|---|
| `<aside id="drawer">` con ~40 nodos siempre en DOM | No se crea ningún nodo del drawer en mobile |
| Ocupaba memoria aunque estuviera oculto (`left: -280px`) | MobileMenu crea HTML solo al abrir, lo destruye al cerrar |
| Los enlaces apuntaban a rutas Desktop (`/solicitudes`) | Los enlaces apuntan a rutas Mobile (`/m/solicitudes`) |
| No tenía detección de rol admin en mobile | `MobileMenu._checkAdmin()` verifica y muestra link Admin |

### Botones

| Antes | Después |
|---|---|
| `padding: 8px 10px` | `padding: 12px 14px` |
| `font-size: 11px` | `font-size: 13px` |
| `min-width: 70px` | `min-height: 48px` (touch target) |
| Clases genéricas + `btn-sol-small` | Clases semánticas con icono + label |
| Sin feedback táctil (`:active`) | `transform: scale(0.94)` + cambio de color |

### Scroll Horizontal

| Antes | Después |
|---|---|
| Chips con fondo plano | Glassmorphism (`backdrop-filter: blur`) |
| Padding reducido | Padding generoso (10px 48px 10px 16px) |
| Chip activo sin realce visual | Chip activo con glow + borde `#818cf8` |
| Sin sombra | `box-shadow` inferior para profundidad |

---

## 7. Compatibilidad

### Desktop — SIN REGRESIONES

| Componente | Estado |
|---|---|
| Drawer flotante (☰) | ✅ Sin cambios en la lógica |
| Drawer panel lateral | ✅ Misma funcionalidad, misma estructura HTML |
| Sidebar de Campañas | ✅ No modificado |
| Botones de Campañas Desktop | ✅ No modificados |
| Overlay + animaciones | ✅ Sin cambios |
| Resize handler | ✅ Restaurado (oculta toggle en <768px) |

### Mobile — MEJORAS

| Componente | Estado |
|---|---|
| Drawer (MobileMenu) | ✅ Nuevo: bottom sheet nativo, creado bajo demanda |
| Botones de Campañas | ✅ Rediseñados: touch targets de 48px mínimo |
| Scroll horizontal | ✅ Mejorado: glassmorphism + animaciones |
| Navegación bottom nav | ✅ Sin cambios, `Drawer.toggle()` sigue funcionando |
| Gestión de solicitudes | ✅ Sin cambios en la lógica de negocio |
| Exportar Excel | ✅ Sin cambios |
| WhatsApp | ✅ Sin cambios |
| Filtros | ✅ Sin cambios |
| Progreso | ✅ Sin cambios en funcionalidad, mejoras visuales |

---

## 8. Casos de Prueba Realizados

| # | Caso | Resultado |
|---|---|---|
| 1 | Abrir página `/m/gestion-lote` en Chrome móvil (viewport <768px) | ✅ No hay `#drawer` ni `#drawer-overlay` en el DOM |
| 2 | Hacer clic en "Menú" del bottom nav | ✅ MobileMenu aparece como bottom sheet con animación |
| 3 | Cerrar MobileMenu con botón ✕ | ✅ Sheet se desliza hacia abajo, DOM se limpia tras 250ms |
| 4 | Verificar que no hay `esRutaMobile()` sin usar | ✅ Función eliminada |
| 5 | Botón 📞 Llamar en tarjeta de campaña | ✅ min-height: 48px, feedback táctil |
| 6 | Botón Seguimiento | ✅ Clase `btn-sol-primary`, altura táctil correcta |
| 7 | Botón WhatsApp Directo | ✅ Nueva clase `btn-sol-whatsapp` |
| 8 | Scroll horizontal de campañas | ✅ Overflow-x: auto funcional, chips con glassmorphism |
| 9 | Abrir `/gestion-lote` en Desktop (viewport >768px) | ✅ Drawer Desktop se renderiza correctamente |
| 10 | Redimensionar ventana Desktop → Mobile | ✅ Toggle flotante se oculta |
| 11 | Abrir perfil.html en mobile | ✅ `Drawer.toggle()` delega a MobileMenu correctamente |
| 12 | Verificar que Desktop no perdió nada | ✅ Misma funcionalidad, mismos estilos |

---

## 9. Confirmación de No Regresiones en Otros Módulos

| Módulo | Riesgo | Resultado |
|---|---|---|
| Desktop Solicitudes | Bajo — Sin cambios | ✅ Sin afectación |
| Desktop Gestiones | Bajo — Sin cambios | ✅ Sin afectación |
| Desktop Importar | Bajo — Sin cambios | ✅ Sin afectación |
| Desktop Relaciones | Bajo — Sin cambios | ✅ Sin afectación |
| Desktop Ventas | Bajo — Sin cambios | ✅ Sin afectación |
| Desktop Historial | Bajo — Sin cambios | ✅ Sin afectación |
| Desktop Perfil | Bajo — Sin cambios | ✅ Sin afectación |
| Mobile Dashboard | Bajo — Solo cambia Drawer → MobileMenu | ✅ Sin afectación |
| Mobile Solicitudes | Bajo — Solo cambia Drawer → MobileMenu | ✅ Sin afectación |
| Mobile Gestiones | Bajo — Solo cambia Drawer → MobileMenu | ✅ Sin afectación |
| Mobile Importar | Bajo — Solo cambia Drawer → MobileMenu | ✅ Sin afectación |
| Mobile Relaciones | Bajo — Solo cambia Drawer → MobileMenu | ✅ Sin afectación |
| Mobile Ventas | Bajo — Solo cambia Drawer → MobileMenu | ✅ Sin afectación |
| Mobile Historial | Bajo — Solo cambia Drawer → MobileMenu | ✅ Sin afectación |
| Admin | Bajo — Sin cambios | ✅ Sin afectación |
| API Routes | Ninguno — Sin cambios en backend | ✅ Sin afectación |

---

## 10. Resumen Técnico

```
Archivos modificados:  4
  - public/js/drawer.js              (REFACTOR)
  - public/movil/css/estilos.css     (+120 líneas)
  - public/movil/gestion-lote.html   (REDISEÑO)
  - public/movil/js/gestion-lote.js  (ACTUALIZACIÓN)

Archivos analizados:   14
Líneas de CSS nuevas:  ~180
Líneas de JS nuevas:   ~150
Dependencias nuevas:   0 (cero)
Librerías nuevas:      0 (cero)
Frameworks nuevos:     0 (cero)
```
