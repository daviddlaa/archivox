// WhatsApp Service - Envío automático de mensajes usando whatsapp-web.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Cliente de WhatsApp singleton
let client = null;
let isReady = false;
let qrCode = null;
let qrCallback = null;

// Inicializar el cliente de WhatsApp
async function initWhatsApp(onQRGenerated, onReady, onDisconnected) {
    qrCallback = onQRGenerated;
    
    console.log('Creating session directory...');
    // Crear directorio para sesión
    const sessionPath = path.join(__dirname, '../../.wwebjs-auth');
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }
    
console.log('Creating WhatsApp client...');
    // Inicializar cliente
    // NOTA: Cambiar a headless: false para depurar si hay problemas
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: '.wwebjs-auth'
        }),
        puppeteer: {
            headless: false,
            devtools: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security'
            ]
        }
    });
    
    console.log('Setting up WhatsApp event handlers...');
    
    // Evento QR
    client.on('qr', (qr) => {
        console.log('\n>>> QR CODE RECEIVED <<<');
        console.log('QR:', qr.substring(0, 80) + '...');
        qrCode = qr;
        if (qrCallback) {
            qrCallback(qr);
        }
    });
    
    // Evento ready
    client.on('ready', () => {
        console.log('\n>>> WHATSAPP CLIENT READY <<<');
        isReady = true;
        qrCode = null;
        if (onReady) {
            onReady();
        }
    });
    
    // Evento authenticated
    client.on('authenticated', () => {
        console.log('\n>>> WHATSAPP AUTHENTICATED <<<');
    });
    
    // Evento auth_failure
    client.on('auth_failure', (error) => {
        console.log('\n!!! AUTH FAILURE !!!');
        console.log(error);
    });
    
    // Evento disconnected
    client.on('disconnected', () => {
        console.log('\n!!! WhatsApp Client Disconnected !!!');
        isReady = false;
        if (onDisconnected) {
            onDisconnected();
        }
    });
    
    // Evento change_state
    client.on('change_state', (state) => {
        console.log('State changed to:', state);
    });
    
    console.log('Calling client.initialize()...');
    // Inicializar
    try {
        await client.initialize();
        console.log('client.initialize() completed.');
    } catch (error) {
        console.error('\n!!! Error initializing WhatsApp !!!');
        console.error(error);
        throw error;
    }
}

// Obtener estado actual
function getStatus() {
    return {
        isReady: isReady,
        qrCode: qrCode
    };
}

// Enviar mensaje de texto
async function sendMessage(phoneNumber, message) {
    if (!client || !isReady) {
        throw new Error('WhatsApp client not ready');
    }
    
    // Limpiar número de teléfono
    let numeroLimpio = String(phoneNumber).replace(/[^0-9]/g, '');
    
    // Si no tiene código de país, agregar 505 (Nicaragua)
    if (numeroLimpio.length === 8) {
        numeroLimpio = '505' + numeroLimpio;
    }
    
    // Formatear número con @c.us
    const chatId = numeroLimpio + '@c.us';
    
    try {
        const result = await client.sendMessage(chatId, message);
        console.log('Message sent to:', phoneNumber);
        return { success: true, messageId: result.id._serialized };
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}

// Enviar mensaje con imagen
async function sendImage(phoneNumber, imagePath, caption) {
    if (!client || !isReady) {
        throw new Error('WhatsApp client not ready');
    }
    
    // Limpiar número
    let numeroLimpio = String(phoneNumber).replace(/[^0-9]/g, '');
    if (numeroLimpio.length === 8) {
        numeroLimpio = '505' + numeroLimpio;
    }
    
    const chatId = numeroLimpio + '@c.us';
    
    try {
        // Cargar imagen
        const mimeType = getMimeType(imagePath);
        const media = await MessageMedia.fromFilePath(imagePath);
        media.mimetype = mimeType;
        
        const result = await client.sendMessage(chatId, media, { caption: caption });
        console.log('Image sent to:', phoneNumber);
        return { success: true, messageId: result.id._serialized };
    } catch (error) {
        console.error('Error sending image:', error);
        throw error;
    }
}

// Obtener tipo MIME basado en extensión
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
}

// Cerrar conexión
async function close() {
    if (client) {
        try {
            await client.destroy();
        } catch (error) {
            console.error('Error closing WhatsApp:', error);
        }
        client = null;
        isReady = false;
    }
}

module.exports = {
    initWhatsApp,
    getStatus,
    sendMessage,
    sendImage,
    close
};
