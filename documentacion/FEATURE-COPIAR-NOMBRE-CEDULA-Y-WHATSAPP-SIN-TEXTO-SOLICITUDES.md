# Feature: Copiar nombre + cédula y WhatsApp sin texto en tarjetas de Solicitudes

## Fecha
03/07/2026

## Archivos modificados
- `public/desktop/js/solicitudes.js`
- `public/movil/js/solicitudes.js`

## Cambio 1 — Click en nombre copia "Nombre - Cédula"

En ambas versiones (móvil y escritorio), al hacer clic en el nombre del cliente dentro de las tarjetas de Solicitudes, se copia al portapapeles el texto `"Nombre Apellido - 1234567890"`.

**Cómo funciona:**
- El nombre tiene `onclick="copiarNombreCedula('nombre', 'cedula')"` y muestra un ícono 📋
- La función `copiarNombreCedula(nombre, cedula)`:
  - Si ambos están presentes → copia `"Nombre - Cédula"`
  - Si solo uno está presente → copia ese valor
  - Si ambos están vacíos → muestra alerta "No hay datos para copiar"
- Usa `navigator.clipboard.writeText()` con fallback de alerta en caso de error

## Cambio 2 — WhatsApp sin texto predefinido

El botón 💬 WhatsApp en las tarjetas ahora abre `https://wa.me/593XXXXXXXXX` **sin `?text=`** (sin mensaje predefinido).

**Cómo funciona:**
- Escritorio: botón llama a `abrirWhatsAppChatEscritorio(celular)` en las `card-actions`
- Móvil: botón llama a `abrirWhatsAppChatMovil(celular)` en los `botones-contacto`
- Ambas funciones: toman el celular, limpian caracteres no-dígito, agregan código +593 si no existe, y abren `https://wa.me/numero` en nueva pestaña

**Nota:** La función `whatsAppCliente(celular, nombre)` (con mensaje) se mantiene intacta para el modal de Gestiones, donde el mensaje predefinido sigue siendo útil.

## Función auxiliar: `escaparParaAtributo(texto)`

Escapa caracteres especiales (comillas simple, barras invertidas) para usar valores seguros dentro de atributos HTML `onclick="..."`.

## Dónde se renderizan los botones

### Escritorio — `renderizarCards()`
```
card-actions:
  [📋 Gestiones] [💬 WhatsApp] [✏️ Completar]
```

### Móvil — `renderizarCards()`
```
botones-contacto:
  [📞] [💬] [📋]
```

## Verificar en producción
1. Limpiar caché del navegador (`Ctrl+F5` o `Cmd+Shift+R`)
2. Ir a la página de Solicitudes
3. Hacer clic en el nombre del cliente — debería copiar "Nombre - Cédula"
4. Hacer clic en 💬 WhatsApp — debería abrir wa.me sin texto
