# 📞 Diagnóstico: Número de teléfono no se reconoce en WhatsApp (Ecuador)

## 🚨 Problema

Al hacer clic en **WhatsApp c/Imagen** (móvil o desktop), se abre WhatsApp pero **no crea el chat** con el número. En lugar de eso, WhatsApp muestra "Buscando número..." o no encuentra el contacto.

## 🔍 Causa Raíz

El código actual tiene esta lógica en ambos archivos (`public/movil/js/gestion-lote.js` y `public/desktop/js/gestion-lote.js`):

```javascript
var numeroLimpio = String(celular).replace(/[^0-9]/g, '');

if (numeroLimpio.length === 8) {
    numeroLimpio = '505' + numeroLimpio;  // ← SOLO para 8 dígitos, y con código de NICARAGUA
}
```

### El problema es doble:

| Problema | Explicación |
|----------|-------------|
| **1. Código de país incorrecto** | Está hardcodeado `505` (Nicaragua) pero estás en **Ecuador** (código `593`) |
| **2. Longitud incorrecta** | Solo agrega código a números de **8 dígitos**. Los móviles ecuatorianos tienen **9 dígitos** (ej: 9XXXXXXXX) y no se les agrega ningún código |

### Formato de números en Ecuador

| Tipo | Formato local | Con código país | Longitud sin código |
|------|---------------|-----------------|-------------------|
| Móvil | 9XXXXXXXX | 5939XXXXXXXX | 9 dígitos |
| Fijo | 2XXXXXXX | 5932XXXXXXX | 7-8 dígitos |

## 📊 Escenarios actuales

| Número en DB | Longitud | Lo que envía hoy | Resultado en WhatsApp |
|-------------|----------|-----------------|----------------------|
| 9XXXXXXXX (móvil Ecuador) | 9 | `9XXXXXXXX` — **sin código** | ❌ No encuentra el número |
| 99XXXXXXXX (10 dígitos) | 10 | `99XXXXXXXX` — sin modificar | ✅ Podría funcionar si tiene 593 al inicio |
| 5939XXXXXXXX (completo) | 12 | `5939XXXXXXXX` — sin modificar | ✅ Funciona |
| 8 dígitos | 8 | `505XXXXXXXX` — código Nicaragua | ❌ Código de país incorrecto |

## ✅ Solución Propuesta

```
┌────────────────────────────────────────┐
│   CONFIGURACIÓN: Código de País        │
│                                        │
│   var PAIS_CODIGO = '593';  // Ecuador │
│   var PAIS_LONGITUD_SIN_CODIGO = 9;    │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│   Formatear número:                    │
│                                        │
│   1. Limpiar (solo dígitos)           │
│   2. ¿Ya tiene código de país?         │
│      → Sí: usarlo como está            │
│      → No: agregar 593                 │
│   3. Enviar a WhatsApp                 │
└────────────────────────────────────────┘
```

### Lógica corregida

```javascript
var PAIS_CODIGO = '593'; // Ecuador
var PAIS_LONGITUD_MIN = 7;  // longitud mínima sin código
var PAIS_LONGITUD_MAX = 9;  // longitud máxima sin código (móviles)

function formatearNumeroWhatsApp(celular) {
    var numero = String(celular).replace(/[^0-9]/g, '');
    
    // Si ya tiene código de país, usarlo directamente
    if (numero.length > PAIS_LONGITUD_MAX) {
        return numero;
    }
    
    // Agregar código de país de Ecuador
    return PAIS_CODIGO + numero;
}
```

## 📁 Archivos a modificar

1. **`public/movil/js/gestion-lote.js`**
   - `abrirWhatsAppMovil()` → aplicar nueva lógica de formateo
   
2. **`public/desktop/js/gestion-lote.js`**
   - `abrirWhatsAppDesktop()` → aplicar misma lógica

## ✅ Notas

- El código de país se define como variable global para que sea fácil de cambiar si migran a otro país
- Detecta automáticamente si el número ya tiene código de país (más de 9 dígitos)
- Aplica el código 593 a números locales ecuatorianos (7-9 dígitos)
