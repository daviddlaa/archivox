const ExcelJS = require('exceljs');
const fs = require('fs');
const db = require('../config/db.js');

const pool = db;

// Determinar si es PostgreSQL (producción) o SQLite (local)
const isPostgres = !!process.env.DATABASE_URL;

/**
 * Convierte valores de fecha Excel (números seriales, objetos Date o cadenas) a formato DATE ISO (YYYY-MM-DD)
 */
function convertirFecha(valor) {
    if (!valor) return null;
    
    // Si es string, verificar si ya es formato válido YYYY-MM-DD
    if (typeof valor === 'string') {
        var trimmed = valor.trim();
        // Si ya es formato ISO, devolver tal cual
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        
        // Detectar formato DD/MM/YYYY o DD-MM-YYYY (usado en Ecuador/Latam)
        // Solo interpretar como DD/MM/YYYY si:
        //   - día > 12 (no podría ser mes) → ej: 15/01/2024
        //   - día ≤ 31 y mes > 12 (el mes no puede ser 13+) → ej: 05/15/2024
        // Si es ambiguo (ambos ≤ 12), new Date() lo interpreta como MM/DD/YYYY
        // Si el primer número tiene 4 dígitos, es YYYY/MM/DD y lo dejamos a new Date()
        var matchDMY = trimmed.match(/^(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,4})$/);
        if (matchDMY && matchDMY[1].length === 2) {
            var parte1 = parseInt(matchDMY[1], 10);
            var parte2 = parseInt(matchDMY[2], 10);
            if (parte1 > 12 || (parte1 <= 31 && parte2 > 12)) {
                var dia = matchDMY[1].padStart(2, '0');
                var mes = matchDMY[2].padStart(2, '0');
                var anio = matchDMY[3].length === 4 ? matchDMY[3] : (parseInt(matchDMY[3]) + 2000).toString();
                return anio + '-' + mes + '-' + dia;
            }
        }
        
        // Intentar convertir string a fecha (formato inglés: "Jan 15 2024")
        var dateFromString = new Date(trimmed);
        if (!isNaN(dateFromString.getTime())) {
            return dateFromString.toISOString().split('T')[0];
        }
        return trimmed;
    }
    
    // Si es objeto Date (Excel convierte fechas a Date)
    if (valor instanceof Date && !isNaN(valor.getTime())) {
        return valor.toISOString().split('T')[0];
    }
    
    // Si es número (fecha serial de Excel), convertir
    if (typeof valor === 'number') {
        const epoch = new Date(1899, 11, 30);
        const fecha = new Date(epoch.getTime() + valor * 86400000);
        return fecha.toISOString().split('T')[0];
    }
    
    // Último intento: convertir a string y parsear
    var str = String(valor);
    var dateAttempt = new Date(str);
    if (!isNaN(dateAttempt.getTime())) {
        return dateAttempt.toISOString().split('T')[0];
    }
    
    return null;
}

// Función para guardar auditoría
const guardarAuditoria = async (solicitudId, usuarioId, campo, valorAnterior, valorNuevo) => {
    try {
        if (isPostgres) {
            await pool.query(
                `INSERT INTO historial_actualizaciones (solicitud_id, usuario_id, campo, valor_anterior, valor_nuevo)
                 VALUES ($1, $2, $3, $4, $5)`,
                [solicitudId, usuarioId, campo, valorAnterior, valorNuevo]
            );
        } else {
            const dbDirect = require('../config/database');
            dbDirect.prepare(
                `INSERT INTO historial_actualizaciones (solicitud_id, usuario_id, campo, valor_anterior, valor_nuevo)
                 VALUES (?, ?, ?, ?, ?)`
            ).run(solicitudId, usuarioId, campo, valorAnterior, valorNuevo);
        }
    } catch (err) {
        console.error('Error guardando auditoría:', err.message);
    }
};

exports.procesarExcel = async (filePath, usuarioId) => {

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);

    // Leer encabezados de la primera fila, manejando celdas vacías
    const headers = [];

    worksheet.getRow(1).eachCell((cell, colNumber) => {
        let headerName = String(cell.value || '').trim();
        if (!headerName) {
            headerName = `COLUMNA_${colNumber}`;
            console.warn(`[Excel] Header vacío en columna ${colNumber}, renombrado a "${headerName}"`);
        }
        headers.push(headerName);
    });

    let procesados = 0;
    let inserts = 0;
    let updates = 0;
    const detalles = [];

    // Variable para auto-generar IDs cuando IDSOLICITUD viene vacío
    // Se inicializa bajo demanda (lazy) cuando se encuentra la primera fila sin ID
    let siguienteIdAuto = null;
    const initSiguienteId = async () => {
        if (isPostgres) {
            const result = await pool.query('SELECT COALESCE(MAX(id_solicitud), 0) + 1 AS next_id FROM solicitudes');
            siguienteIdAuto = parseInt(result.rows[0].next_id);
        } else {
            const dbDirect = require('../config/database');
            const row = dbDirect.prepare('SELECT COALESCE(MAX(id_solicitud), 0) + 1 AS next_id FROM solicitudes').get();
            siguienteIdAuto = row.next_id;
        }
    };

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

        const row = worksheet.getRow(rowNumber);

        const registro = {};

        row.eachCell((cell, colNumber) => {
            registro[headers[colNumber - 1]] = cell.value;
        });

        // ===== NORMALIZAR VALORES VACÍOS =====
        let idFueAutoGenerado = false;
        // Auto-generar ID si IDSOLICITUD viene vacío
        if (registro.IDSOLICITUD == null || String(registro.IDSOLICITUD).trim() === '') {
            if (siguienteIdAuto === null) {
                await initSiguienteId();
            }
            registro.IDSOLICITUD = siguienteIdAuto++;
            idFueAutoGenerado = true;
        }
        
        // Asignar "SIN ESTADO" por defecto si ESTADO viene vacío
        if (!registro.ESTADO || String(registro.ESTADO).trim() === '') {
            registro.ESTADO = 'SIN ESTADO';
        }
        
        // Convertir fecha a formato YYYY-MM-DD (tolera cualquier formato: serial, Date, string)
        registro.FECHASOLICITUD = convertirFecha(registro.FECHASOLICITUD);

        try {
            if (isPostgres) {
                // PostgreSQL: Usar pool.query async
                // Verificar si existe
                let existing;
                if (idFueAutoGenerado && registro.CEDULA && String(registro.CEDULA).trim() !== '') {
                    // Buscar por CÉDULA para evitar duplicados al re-subir el mismo Excel
                    existing = await pool.query(
                        'SELECT id, id_solicitud, estado, segmento FROM solicitudes WHERE cedula = $1 AND usuario_id = $2',
                        [registro.CEDULA, usuarioId]
                    );
                } else {
                    existing = await pool.query(
                        'SELECT id, id_solicitud, estado, segmento FROM solicitudes WHERE id_solicitud = $1',
                        [registro.IDSOLICITUD]
                    );
                }

                if (existing.rows.length > 0) {
                    // Update - capturar valores anteriores
                    const oldData = existing.rows[0];
                    const existingIdSol = oldData.id_solicitud;
                    const oldEstado = oldData.estado;
                    const oldSegmento = oldData.segmento;
                    
                    // Si el ID fue auto-generado pero encontramos por CEDULA,
                    // usar el ID existente para no duplicar
                    if (idFueAutoGenerado) {
                        registro.IDSOLICITUD = existingIdSol;
                    }
                    
                    // Ejecutar update
                    await pool.query(
                        `UPDATE solicitudes SET
                            estado = $1,
                            cedula = $2,
                            nombre = $3,
                            celular = $4,
                            segmento = $5,
                            producto = $6,
                            fecha_solicitud = $7,
                            usuario_id = $8,
                            fecha_actualizacion = CURRENT_TIMESTAMP
                        WHERE id_solicitud = $9`,
                        [
                            registro.ESTADO,
                            registro.CEDULA,
                            registro.NOMBRE,
                            registro.CELULAR,
                            registro.SEGMENTO,
                            registro.PRODUCTO,
                            registro.FECHASOLICITUD,
                            usuarioId,
                            existingIdSol
                        ]
                    );
                    
                    // Guardar auditoría si cambió estado o segmento
                    if (oldEstado !== registro.ESTADO) {
                        await guardarAuditoria(existingIdSol, usuarioId, 'estado', oldEstado, registro.ESTADO);
                        detalles.push({
                            id: existingIdSol,
                            campo: 'estado',
                            anterior: oldEstado,
                            nuevo: registro.ESTADO
                        });
                    }
                    if (oldSegmento !== registro.SEGMENTO) {
                        await guardarAuditoria(existingIdSol, usuarioId, 'segmento', oldSegmento, registro.SEGMENTO);
                        detalles.push({
                            id: existingIdSol,
                            campo: 'segmento',
                            anterior: oldSegmento,
                            nuevo: registro.SEGMENTO
                        });
                    }
                    
                    updates++;
                } else {
                    // Insert
                    await pool.query(
                        `INSERT INTO solicitudes (
                            id_solicitud, estado, cedula, nombre, celular,
                            segmento, producto, fecha_solicitud, usuario_id
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [
                            registro.IDSOLICITUD,
                            registro.ESTADO,
                            registro.CEDULA,
                            registro.NOMBRE,
                            registro.CELULAR,
                            registro.SEGMENTO,
                            registro.PRODUCTO,
                            registro.FECHASOLICITUD,
                            usuarioId
                        ]
                    );
                    inserts++;
                }
            } else {
                // SQLite: Usar módulo directo
                const dbDirect = require('../config/database');
                
                let existing;
                if (idFueAutoGenerado && registro.CEDULA && String(registro.CEDULA).trim() !== '') {
                    existing = dbDirect.prepare(
                        'SELECT id, id_solicitud, estado, segmento FROM solicitudes WHERE cedula = ? AND usuario_id = ?'
                    ).get(registro.CEDULA, usuarioId);
                } else {
                    existing = dbDirect.prepare(
                        'SELECT id, id_solicitud, estado, segmento FROM solicitudes WHERE id_solicitud = ?'
                    ).get(registro.IDSOLICITUD);
                }

                if (existing) {
                    // Update - capturar valores anteriores
                    const existingIdSol = existing.id_solicitud;
                    const oldEstado = existing.estado;
                    const oldSegmento = existing.segmento;
                    
                    // Si el ID fue auto-generado pero encontramos por CEDULA,
                    // usar el ID existente para no duplicar
                    if (idFueAutoGenerado) {
                        registro.IDSOLICITUD = existingIdSol;
                    }
                    
                    // Ejecutar update
                    dbDirect.prepare(`
                        UPDATE solicitudes SET
                            estado = ?,
                            cedula = ?,
                            nombre = ?,
                            celular = ?,
                            segmento = ?,
                            producto = ?,
                            fecha_solicitud = ?,
                            usuario_id = ?,
                            fecha_actualizacion = datetime('now')
                        WHERE id_solicitud = ?
                    `).run(
                        registro.ESTADO,
                        registro.CEDULA,
                        registro.NOMBRE,
                        registro.CELULAR,
                        registro.SEGMENTO,
                        registro.PRODUCTO,
                        registro.FECHASOLICITUD,
                        usuarioId,
                        existingIdSol
                    );
                    
                    // Guardar auditoría si cambió estado o segmento
                    if (oldEstado !== registro.ESTADO) {
                        await guardarAuditoria(existingIdSol, usuarioId, 'estado', oldEstado, registro.ESTADO);
                        detalles.push({
                            id: existingIdSol,
                            campo: 'estado',
                            anterior: oldEstado,
                            nuevo: registro.ESTADO
                        });
                    }
                    if (oldSegmento !== registro.SEGMENTO) {
                        await guardarAuditoria(existingIdSol, usuarioId, 'segmento', oldSegmento, registro.SEGMENTO);
                        detalles.push({
                            id: existingIdSol,
                            campo: 'segmento',
                            anterior: oldSegmento,
                            nuevo: registro.SEGMENTO
                        });
                    }
                    
                    updates++;
                } else {
                    // Insert
                    dbDirect.prepare(`
                        INSERT INTO solicitudes (
                            id_solicitud, estado, cedula, nombre, celular,
                            segmento, producto, fecha_solicitud, usuario_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        registro.IDSOLICITUD,
                        registro.ESTADO,
                        registro.CEDULA,
                        registro.NOMBRE,
                        registro.CELULAR,
                        registro.SEGMENTO,
                        registro.PRODUCTO,
                        registro.FECHASOLICITUD,
                        usuarioId
                    );
                    inserts++;
                }
            }

            procesados++;
        } catch (err) {
            console.error('Error procesando fila:', rowNumber, err.message);
        }
    }

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    return {
        total: procesados,
        inserts: inserts,
        updates: updates,
        detalles: detalles
    };
};
