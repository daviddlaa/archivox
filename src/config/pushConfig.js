// ============================================================================
// CONFIGURACIÓN DE WEB PUSH (VAPID)
// ============================================================================
// Claves VAPID para la Web Push API. Se leen de variables de entorno:
//   VAPID_PUBLIC_KEY  → clave pública (se envía al frontend para suscribirse)
//   VAPID_PRIVATE_KEY  → clave privada (firma de los mensajes push)
//   VAPID_SUBJECT      → contacto (mailto:) que los push services exigen
//
// Generar el par de claves con: npx web-push generate-vapid-keys
// ============================================================================

const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:soporte@archivox.com';

// true si hay configuración VAPID completa (public + private + subject)
const configurado = Boolean(publicKey && privateKey && /^https?:|^mailto:/.test(subject));

if (process.env.VAPID_PUBLIC_KEY && !configurado) {
    console.error('[Push] Configuración VAPID incompleta (revisa VAPID_* en env). Push deshabilitado.');
}

module.exports = {
    publicKey,
    privateKey,
    subject,
    configurado,
};