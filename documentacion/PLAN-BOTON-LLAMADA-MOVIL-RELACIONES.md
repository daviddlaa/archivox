# PLAN: Botón de Llamada al Dialer — Versión Móvil (Relaciones)

## Problema actual

En la versión móvil de Relaciones (`public/movil/js/relaciones.js`), el botón **📞** ejecuta `gestionarRelacionMovil(id, 'Llamada')`, que abre el modal de gestión (tipo + observación + guardar). **No abre el dialer del teléfono.**

El usuario necesita que al tocar 📞 se abra **directamente el dialer** para llamar al cliente, como ya funciona en la página de Solicitudes (`solicitudes.js`).

## Solución propuesta

### 1. Nueva función `llamarRelacionMovil(celular)`

Sigue el mismo patrón que `llamarCliente()` en `solicitudes.js`:

```js
function llamarRelacionMovil(celular) {
    if (!celular) {
        alert('No hay número de celular');
        return;
    }
    var numeroLimpio = String(celular).replace(/\D/g, '');
    window.location.href = 'tel:' + numeroLimpio;
}
```

### 2. Cambio en la card móvil

En `renderizarCardsMovil()`, el botón 📞 se cambia de:

```html
<button class="btn-sm-movil btn-sm-call" onclick="gestionarRelacionMovil(...)">📞</button>
```

a:

```html
<button class="btn-sm-movil btn-sm-call" onclick="llamarRelacionMovil('0991234567')">📞</button>
```

### 3. ¿Se pierde la funcionalidad de registrar llamadas?

**No.** El usuario puede registrar una llamada usando el botón **📋 Seguimiento** (que sí abre el modal de gestión con tipo seleccionable). La acción de marcar es inmediata, sin formulario intermedio — exactamente como funciona en `solicitudes.js`.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `public/movil/js/relaciones.js` | Agregar función `llamarRelacionMovil` + cambiar onclick en la card |

**Ningún otro archivo se toca.** Backend intacto.

## Flujo final

1. Usuario ve card de cliente en móvil
2. Toca **📞** → inmediatamente abre el dialer con el número del cliente
3. (Opcional) Si quiere registrar la llamada como gestión, usa **📋** (Seguimiento)
4. El botón 💬 WhatsApp y 💬→ Directo siguen igual

---

¿Apruebas este cambio?
