// WhatsApp Routes - Rutas para enviar mensajes
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');

// GET /status - obtener estado de WhatsApp
router.get('/status', whatsappController.getStatus);

// POST /send - enviar mensaje de texto
router.post('/send', whatsappController.sendMessage);

// POST /send-image - enviar mensaje con imagen
router.post('/send-image', whatsappController.sendImage);

module.exports = router;
