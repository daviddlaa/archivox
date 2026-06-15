const ExcelJS = require('exceljs');
const fs = require('fs');
const db = require('../config/db.js');

const pool = db;

// Determinar si es PostgreSQL (producción) o SQLite (local)
const isPostgres = !!process.env.DATABASE_URL;

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

    const headers = [];

    worksheet.getRow(1).eachCell((cell) => {
        headers.push(String(cell.value).trim());
    });

    let procesados = 0;
    let inserts = 0;
    let updates = 0;
    const detalles = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

        const row = worksheet.getRow(rowNumber);

        const registro = {};

        row.eachCell((cell, colNumber) => {
            registro[headers[colNumber - 1]] = cell.value;
        });

        try {
            if (isPostgres) {
                // PostgreSQL: Usar pool.query async
                // Verificar si existe
                const existing = await pool.query(
                    'SELECT id, estado, segmento FROM solicitudes WHERE id_solicitud = $1',
                    [registro.IDSOLICITUD]
                );

                if (existing.rows.length > 0) {
                    // Update - capturar valores anteriores
                    const oldData = existing.rows[0];
                    const oldEstado = oldData.estado;
                    const oldSegmento = oldData.segmento;
                    
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
                            registro.IDSOLICITUD
                        ]
                    );
                    
                    // Guardar auditoría si cambió estado o segmento
                    if (oldEstado !== registro.ESTADO) {
                        await guardarAuditoria(registro.IDSOLICITUD, usuarioId, 'estado', oldEstado, registro.ESTADO);
                        detalles.push({
                            id: registro.IDSOLICITUD,
                            campo: 'estado',
                            anterior: oldEstado,
                            nuevo: registro.ESTADO
                        });
                    }
                    if (oldSegmento !== registro.SEGMENTO) {
                        await guardarAuditoria(registro.IDSOLICITUD, usuarioId, 'segmento', oldSegmento, registro.SEGMENTO);
                        detalles.push({
                            id: registro.IDSOLICITUD,
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
                
                const existing = dbDirect.prepare(
                    'SELECT id, estado, segmento FROM solicitudes WHERE id_solicitud = ?'
                ).get(registro.IDSOLICITUD);

                if (existing) {
                    // Update - capturar valores anteriores
                    const oldEstado = existing.estado;
                    const oldSegmento = existing.segmento;
                    
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
                        registro.IDSOLICITUD
                    );
                    
                    // Guardar auditoría si cambió estado o segmento
                    if (oldEstado !== registro.ESTADO) {
                        await guardarAuditoria(registro.IDSOLICITUD, usuarioId, 'estado', oldEstado, registro.ESTADO);
                        detalles.push({
                            id: registro.IDSOLICITUD,
                            campo: 'estado',
                            anterior: oldEstado,
                            nuevo: registro.ESTADO
                        });
                    }
                    if (oldSegmento !== registro.SEGMENTO) {
                        await guardarAuditoria(registro.IDSOLICITUD, usuarioId, 'segmento', oldSegmento, registro.SEGMENTO);
                        detalles.push({
                            id: registro.IDSOLICITUD,
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
