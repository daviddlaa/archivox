// ============================================================================
// MONITOR DE CONEXIONES Y SEGURIDAD
// ============================================================================
// Datos en memoria del proceso (al igual que express-rate-limit):
//  - Peticiones por usuario (ventana deslizante de 15 min)
//  - Bloqueos por rate limit (429)
//  - Conteo total de peticiones y uptime del servidor
// ============================================================================

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

const state = {
    startTime: Date.now(),
    totalRequests: 0,
    userRequests: new Map(), // usuarioId -> { count, windowStart }
    blocks: 0,
    lastBlockAt: null,
    lastBlockKey: null,
};

// ============================================================================
// REGISTRAR UNA PETICIÓN
// ============================================================================
// Se llama por cada petición HTTP (middleware global). Solo cuenta las
// peticiones de API y las atribuye al usuario autenticado si existe.
function registerRequest(req) {
    state.totalRequests++;

    const path = req.path || req.url || '';
    if (!path.startsWith('/api')) return; // Solo interesa el tráfico de API

    const userId = req.session?.usuario?.id;
    if (!userId) return;

    const now = Date.now();
    const entry = state.userRequests.get(userId);
    if (!entry || (now - entry.windowStart) > WINDOW_MS) {
        state.userRequests.set(userId, { count: 1, windowStart: now });
    } else {
        entry.count++;
    }
}

// ============================================================================
// REGISTRAR UN BLOQUEO POR RATE LIMIT
// ============================================================================
// Se llama desde el handler del rate limiter cuando responde 429.
function registerBlock(key) {
    state.blocks++;
    state.lastBlockAt = new Date();
    state.lastBlockKey = key;
}

// ============================================================================
// OBTENER ESTADÍSTICAS (para el Panel de SuperAdmin)
// ============================================================================
function getStats() {
    const now = Date.now();

    // Limpiar ventanas vencidas
    for (const [userId, entry] of state.userRequests) {
        if ((now - entry.windowStart) > WINDOW_MS) {
            state.userRequests.delete(userId);
        }
    }

    const users = [];
    for (const [userId, entry] of state.userRequests) {
        users.push({
            usuario_id: Number(userId),
            peticiones_15min: entry.count,
        });
    }
    users.sort((a, b) => b.peticiones_15min - a.peticiones_15min);

    return {
        uptimeSegundos: Math.floor((now - state.startTime) / 1000),
        totalPeticiones: state.totalRequests,
        usuariosActivos: users.length,
        usuarios: users,
        bloqueosRateLimit: {
            total: state.blocks,
            ultimo: state.lastBlockAt,
            ultimaClave: state.lastBlockKey,
        },
    };
}

module.exports = { registerRequest, registerBlock, getStats };
