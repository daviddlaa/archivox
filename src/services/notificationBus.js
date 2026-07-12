// ============================================================================
// NOTIFICATION BUS - Sistema de eventos para notificaciones en tiempo real (SSE)
// ============================================================================
// Permite que el servidor empuje notificaciones a los clientes conectados
// usando Server-Sent Events (SSE).
// ============================================================================

const EventEmitter = require('events');

// Máximo de conexiones SSE por usuario (evita abuso/conexiones zombie)
const MAX_CONNECTIONS_PER_USER = 5;
// Máximo total de clientes SSE
const MAX_TOTAL_CLIENTS = 500;

class NotificationBus extends EventEmitter {
    constructor() {
        super();
        this.clients = new Map();  // clientId -> { res, usuarioId }
        this.clientIdCounter = 0;
    }

    // ========================================================================
    // AGREGAR CLIENTE SSE
    // ========================================================================
    addClient(res, usuarioId) {
        // Limitar conexiones totales
        if (this.clients.size >= MAX_TOTAL_CLIENTS) {
            console.warn(`[SSE] Límite total alcanzado (${MAX_TOTAL_CLIENTS}), rechazando nueva conexión`);
            res.status(503).json({ error: 'Servicio de notificaciones saturado' });
            return null;
        }

        // Limitar conexiones por usuario
        const userConnections = this._getUserConnectionCount(usuarioId);
        if (userConnections >= MAX_CONNECTIONS_PER_USER) {
            console.warn(`[SSE] Usuario #${usuarioId} tiene ${userConnections} conexiones, máximo ${MAX_CONNECTIONS_PER_USER}`);
            // Cerrar la conexión más antigua de este usuario
            this._removeOldestUserConnection(usuarioId);
        }

        const clientId = ++this.clientIdCounter;
        const client = { res, usuarioId, _createdAt: Date.now() };
        this.clients.set(clientId, client);

        // Configurar headers SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',  // Deshabilitar buffering de Nginx
        });

        // Enviar evento de conexión inicial
        this._sendToClient(res, 'connected', { clientId, timestamp: new Date().toISOString() });

        // Mantener viva la conexión con pings periódicos
        client._keepAlive = setInterval(() => {
            try {
                this._sendToClient(res, 'ping', { time: new Date().toISOString() });
            } catch (e) {
                this._removeClient(clientId);
            }
        }, 30000); // cada 30 segundos

        // Limpiar al desconectar
        res.on('close', () => {
            this._removeClient(clientId);
        });

        return clientId;
    }

    // ========================================================================
    // CONTAR CONEXIONES DE UN USUARIO
    // ========================================================================
    _getUserConnectionCount(usuarioId) {
        let count = 0;
        for (const [, client] of this.clients) {
            if (client.usuarioId === usuarioId) count++;
        }
        return count;
    }

    // ========================================================================
    // ELIMINAR LA CONEXIÓN MÁS ANTIGUA DE UN USUARIO
    // ========================================================================
    _removeOldestUserConnection(usuarioId) {
        let oldestId = null;
        let oldestTimestamp = Infinity;
        for (const [clientId, client] of this.clients) {
            if (client.usuarioId === usuarioId && client._createdAt < oldestTimestamp) {
                oldestId = clientId;
                oldestTimestamp = client._createdAt;
            }
        }
        if (oldestId !== null) {
            this._removeClient(oldestId);
        }
    }

    // ========================================================================
    // EMITIR EVENTO A CLIENTES (filtrado por destinatario)
    // ========================================================================
    emitir(event, data, destinatarioId = null) {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        const clientsToDelete = [];
        
        for (const [clientId, client] of this.clients) {
            try {
                // Si la notificación es para un usuario específico, solo enviar a ese usuario
                if (destinatarioId !== null && client.usuarioId !== destinatarioId) {
                    continue;
                }
                client.res.write(`event: ${event}\n${payload}`);
            } catch (e) {
                clientsToDelete.push(clientId);
            }
        }
        
        // Limpiar clientes desconectados (después del bucle para evitar modificar el Map durante la iteración)
        for (const clientId of clientsToDelete) {
            this._removeClient(clientId);
        }
    }

    // ========================================================================
    // EMITIR A UN USUARIO ESPECÍFICO
    // ========================================================================
    emitirAUsuario(event, data, usuarioId) {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        const clientsToDelete = [];
        
        for (const [clientId, client] of this.clients) {
            if (client.usuarioId === usuarioId) {
                try {
                    client.res.write(`event: ${event}\n${payload}`);
                } catch (e) {
                    clientsToDelete.push(clientId);
                }
            }
        }
        
        for (const clientId of clientsToDelete) {
            this._removeClient(clientId);
        }
    }

    // ========================================================================
    // LIMPIAR UN CLIENTE (cierra keepAlive y elimina del Map)
    // ========================================================================
    _removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            if (client._keepAlive) {
                clearInterval(client._keepAlive);
            }
            this.clients.delete(clientId);
        }
    }

    // ========================================================================
    // ENVIAR MENSAJE DIRECTO A UN CLIENTE
    // ========================================================================
    _sendToClient(res, event, data) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    // ========================================================================
    // OBTENER ESTADÍSTICAS DE CONEXIONES
    // ========================================================================
    getStats() {
        return {
            totalClients: this.clients.size,
            clients: Array.from(this.clients.values()).map(c => ({
                usuarioId: c.usuarioId
            }))
        };
    }
}

// Singleton
const notificationBus = new NotificationBus();
module.exports = notificationBus;
