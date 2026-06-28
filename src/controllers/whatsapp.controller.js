// WhatsApp Controller - Manejar envío de mensajes
const whatsappService = require('../services/whatsapp.service');
const path = require('path');

// Estado del sistema WhatsApp
let whatsappInicializado = false;
let qrCode = null;

// Inicializar WhatsApp al iniciar el servidor
async function initWhatsAppServer(app) {
    console.log('\n========================================');
    console.log('Initializing WhatsApp service...');
    console.log('========================================\n');
    
    try {
        await whatsappService.initWhatsApp(
            // onQRGenerated
            (qr) => {
                console.log('\n>>> WhatsApp QR code generated!');
                console.log('QR:', qr ? qr.substring(0, 50) + '...' : 'null');
                qrCode = qr;
                whatsappInicializado = true;
                if (app) {
                    app.emit('whatsapp:qr', qr);
                }
            },
            // onReady
            () => {
                console.log('\n>>> WhatsApp is ready! <<<\n');
                whatsappInicializado = true;
                qrCode = null;
                if (app) {
                    app.emit('whatsapp:ready');
                }
            },
            // onDisconnected
            () => {
                console.log('\n!!! WhatsApp disconnected !!!');
                whatsappInicializado = false;
                if (app) {
                    app.emit('whatsapp:disconnected');
                }
            }
        );
        console.log('WhatsApp service initialization started.');
    } catch (error) {
        console.error('\n!!! Error initializing WhatsApp !!!');
        console.error(error);
    }
}

// GET status - obtener estado de WhatsApp
function getStatus(req, res) {
    const status = whatsappService.getStatus();
    res.json({
        initialized: whatsappInicializado,
        isReady: status.isReady,
        qrCode: status.qrCode
    });
}

// POST send - enviar mensaje
async function sendMessage(req, res) {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Número de teléfono requerido' });
        }
        
        if (!message) {
            return res.status(400).json({ error: 'Mensaje requerido' });
        }
        
        console.log('Sending WhatsApp to:', phoneNumber);
        
        const result = await whatsappService.sendMessage(phoneNumber, message);
        
        res.json({
            success: true,
            messageId: result.messageId
        });
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
}

// POST send-image - enviar mensaje con imagen
async function sendImage(req, res) {
    try {
        const { phoneNumber, message, imagePath } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Número de teléfono requerido' });
        }
        
        if (!imagePath) {
            return res.status(400).json({ error: 'Ruta de imagen requerida' });
        }
        
        console.log('Sending WhatsApp with image to:', phoneNumber);
        
        const result = await whatsappService.sendImage(phoneNumber, imagePath, message || '');
        
        res.json({
            success: true,
            messageId: result.messageId
        });
    } catch (error) {
        console.error('Error sending WhatsApp image:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    initWhatsAppServer,
    getStatus,
    sendMessage,
    sendImage
};
