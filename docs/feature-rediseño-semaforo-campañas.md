# 🎨 Feature: Rediseño del Indicador de Estado (Semáforo) de Campañas

**Versión:** 2.0  
**Fecha:** Agosto 2026  
**Estado:** Implementado ✅

---

## 📋 Resumen

Rediseño completo del indicador de estado visual (semáforo) utilizado en las campañas de gestión por lotes. El sistema evolucionó desde un diseño industrial con border-left saturado hasta un estilo premium inspirado en Apple Wallet, Linear y Notion.

**V2 (Actual):** Banda horizontal 4px + chips premium con borde + label + animaciones más visibles.

---

## 🎯 Problemas del Diseño Original

| Problema | Descripción |
|----------|-------------|
| **Border-left industrial** | Borde vertical de 5px rompía la armonía visual de la tarjeta |
| **Colores saturados** | `#86efac`, `#fde047`, `#fca5a5` parecían alertas permanentes |
| **Chips de texto grandes** | 4 botones por tarjeta robaban demasiado espacio vertical |
| **Gradientes intensos** | Fondos degradados saturados eran visualmente pesados |
| **Animación imperceptible** | Flash casi invisible al hacer scroll rápido |
| **Falta de integración** | El componente parecía agregado posteriormente |

---

## ✅ Solución Implementada: Opción A (Apple Wallet / Linear)

### 1. Nueva Paleta de Colores (iOS-Style, Muted)

| Estado | Color HEX | Nombre | Uso |
|--------|-----------|--------|-----|
| Sin clasificar | `#94a3b8` | Cool Gray | Punto, segmento de barra, banda superior |
| Verde | `#6b9e78` | Sage Green | Punto, segmento de barra, banda superior |
| Amarillo | `#c5975b` | Warm Amber | Punto, segmento de barra, banda superior |
| Rojo | `#c27070` | Soft Coral | Punto, segmento de barra, banda superior |

**Variantes por estado:**
- `--sem-{color}`: Color principal del punto
- `--sem-{color}-bg`: Fondo del pill activo
- `--sem-{color}-surface`: Borde del pill activo
- `--sem-{color}-text`: Texto del pill activo

### 2. Tarjetas de Solicitud — Wide Horizontal Band (V2)

**ANTES (V1):**
```css
/* Línea sutil 2px */
.sol-card::before {
    left: 16px;
    right: 16px;
    height: 2px;
    opacity: 0.55;
}
```

**AHORA (V2):**
```css
/* Banda horizontal completa 4px */
.sol-card::before {
    left: 0;
    right: 0;
    height: 4px;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    opacity: 1;
}

.sol-card.sol-semaforo-verde::before { background: var(--sem-verde); }
```

### 3. Barra de Distribución (Distribution Bar)

**ANTES:** Bloques segmentados con texto y colores saturados  
**AHORA:** Barra horizontal suave de 8px con segmentos proporcionales

```css
.semaforo-barra {
    height: 8px;
    border-radius: 999px;
    gap: 2px;
}

.semaforo-seg {
    border-radius: 999px;
    transition: flex 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Características:**
- Segmentos vacíos se comprimen automáticamente (`min-width: 6px`)
- Transiciones suaves con `cubic-bezier`
- Leyenda debajo con puntos de color + conteos

### 4. Premium Filter Chips (V2)

**ANTES (V1):** Pills compactos sin borde  
**AHORA (V2):** Chips premium estilo Apple/Linear con borde, label y mejor contraste

```html
<div class="sol-semaforo-pills">
    <span class="sol-semaforo-pills-label">Semáforo:</span>
    <button class="sol-semaforo-pill active" data-val="verde">
        <span class="sol-semaforo-pill-dot"></span>
        Verde
    </button>
    <!-- ... más pills -->
</div>
```

**Características (V2):**
- Chips con borde suave (`border-radius: 6px`)
- Label "Semáforo:" para contexto
- Pills inactivos: fondo blanco, borde gris claro
- Pills activos: fondo coloreado suave + borde coloreado + sombra sutil
- Hover: elevación con sombra y `translateY(-1px)`
- Punto de color con `breathing glow` más visible

### 5. Animaciones Premium (V2 — Más visibles)

| Animación | Descripción | Duración |
|-----------|-------------|----------|
| **Breathing Glow** | Halo visible en el punto activo | 2s infinite |
| **Card Flash** | Sombra + borde al cambiar estado | 0.8s |
| **Bar Bump** | Escala vertical del segmento | 0.5s |
| **Fly Particle** | Partícula animada hacia la barra | 0.6s |
| **Chip Hover** | Elevación con sombra al pasar mouse | 0.2s |

```css
@keyframes pill-glow-v2 {
    0%, 100% { box-shadow: 0 0 0 0 transparent; }
    50% { box-shadow: 0 0 0 4px rgba(0,0,0,0.08); }
}

@keyframes sol-semaforo-flash-v2 {
    0% { box-shadow: var(--shadow-sm); }
    30% { box-shadow: 0 4px 20px rgba(99,102,241,0.12), 0 0 0 2px rgba(99,102,241,0.15); }
    60% { box-shadow: 0 2px 10px rgba(99,102,241,0.08); }
    100% { box-shadow: var(--shadow-sm); }
}
```

---

## 📁 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `public/css/gestion-lote.css` | Paleta, banda 4px, chips premium, animaciones V2 |
| `public/desktop/gestion-lote.html` | Leyenda del semáforo |
| `public/desktop/js/gestion-lote.js` | Renderizado de chips con label "Semáforo:" |

---

## ♿ Accesibilidad

| Criterio | Implementación |
|----------|----------------|
| **Contraste** | Colores sobre fondo claro con buena legibilidad |
| **Roles ARIA** | `role="group"` y `aria-label` en barra y pills |
| **Tooltips** | Todos los elementos interactivos tienen `title` |
| **No solo color** | Punto + texto + fondo proporcionan información redundante |
| **Tamaño mínimo** | Pills tienen `min-height` adecuado para touch |

---

## 🧪 Testing Recomendado

1. **Visual:** Verificar que los colores se ven correctos en diferentes monitores
2. **Interacción:** Cambiar estados y verificar animaciones suaves
3. **Filtrado:** Probar filtro por semáforo en la barra superior
4. **Responsive:** Verificar en pantallas pequeñas (la leyenda se adapta)
5. **Accesibilidad:** Navegar con teclado y verificar tooltips

---

## 📊 Comparación Visual

### Original (antes del V1)
```
┌─────────────────────────────────┐
│ ███ #12345 | 🔥 Destacar | Pendiente │  ← Border-left industrial
│ ─────────────────────────────── │
│ Nombre del Cliente              │
│ 📱 0991234567 | 🏷️ Segmento   │
│ ─────────────────────────────── │
│ [Sin clasificar] [Verde] [Amarillo] [Rojo]  ← 4 chips grandes
│ ─────────────────────────────── │
│ 📋 Seguimiento | 💬 Directo    │
└─────────────────────────────────┘
```

### V1 (primera mejora)
```
┌─────────────────────────────────┐
│  ─────────────────────────────  │  ← Línea 2px (muy sutil)
│ #12345 | 🔥 Destacar | Pendiente │
│ Nombre del Cliente              │
│ 📱 0991234567 | 🏷️ Segmento   │
│ 📝 Observación...               │
│ ● Sin Clasificar ● Verde ● Amarillo ● Rojo  ← Pills pequeños
│ 📋 Seguimiento | 💬 Directo    │
└─────────────────────────────────┘
```

### V2 (actual — premium)
```
┌─────────────────────────────────┐
│ ████████████████████████████████│  ← Banda 4px completa
│                                 │
│ #12345 | 🔥 Destacar | Pendiente │
│ Nombre del Cliente              │
│ 📱 0991234567 | 🏷️ Segmento   │
│ 📝 Observación...               │
│ Semáforo:                       │
│ [● Sin Clasificar] [● Verde]   │  ← Chips premium con borde
│ [● Amarillo] [● Rojo]          │
│ 📋 Seguimiento | 💬 Directo    │
└─────────────────────────────────┘
```

---

## 🔗 Relacionado

- **Módulo:** Gestión por Lotes (`/gestion-lote`)
- **Controlador:** `gestionesMaestro.controller.js`
- **API:** `PUT /api/gestiones-maestro/:id/solicitudes/:solicitud_id/semaforo`

---

## 📝 Notas para Desarrolladores

1. **Variables CSS:** Todas las variables del semáforo están en `:root` al inicio de `gestion-lote.css`
2. **Clases CSS:** `.sol-semaforo-pills`, `.sol-semaforo-pill`, `.sol-semaforo-pill-dot`, `.sol-semaforo-pills-label`
3. **Banda superior:** El `::before` de `.sol-card` crea la banda de color (4px, full width)
4. **Label:** El label "Semáforo:" se agrega dinámicamente en `renderizarSolicitudes()`
5. **Animaciones V2:** `pill-glow-v2` (2s) y `sol-semaforo-flash-v2` (0.8s) son más visibles
6. **Responsive:** Los pills se adaptan con `font-size: 10px` y `padding` reducido
