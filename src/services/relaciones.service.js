const ExcelJS = require('exceljs');
const fs = require('fs');
const pool = require('../config/db');

const isPostgres = !!process.env.DATABASE_URL;

/**
 * Mapea los nombres de columna del Excel a los campos de la DB.
 * El Excel tiene estos encabezados:
 *   IDENTIFICACIÓN, CLIENTE, CELULAR, ESTADO RELACIÓN,
 *   FECHA INICIO RELACIÓN, FECHA FIN RELACIÓN, FECHA FIN CRÉDITO,
 *   FECHA FIN FIDELIZACIÓN, PRÓXIMA BAJA, MOTIVO RUPTURA, # OPERACIONES
 */
function mapearRegistro(row) {
    return {
        identificacion: String(row['IDENTIFICACIÓN'] || row['IDENTIFICACION'] || '').trim(),
        cliente: String(row['CLIENTE'] || '').trim(),
        celular: String(row['CELULAR'] || '').trim(),
        estado_relacion: String(row['ESTADO RELACIÓN'] || row['ESTADO RELACION'] || '').trim().toUpperCase(),
        fecha_inicio_relacion: row['FECHA INICIO RELACIÓN'] || row['FECHA INICIO RELACION'] || null,
        fecha_fin_relacion: row['FECHA FIN RELACIÓN'] || row['FECHA FIN RELACION'] || null,
        fecha_fin_credito: row['FECHA FIN CRÉDITO'] || row['FECHA FIN CREDITO'] || null,
        fecha_fin_fidelizacion: row['FECHA FIN FIDELIZACIÓN'] || row['FECHA FIN FIDELIZACION'] || null,
        proxima_baja: row['PRÓXIMA BAJA'] || row['PROXIMA BAJA'] || null,
        motivo_ruptura: row['MOTIVO RUPTURA'] || '',
        numero_operaciones: parseInt(row['# OPERACIONES'] || row['OPERACIONES'] || 0, 10) || 0
    };
}

/**
 * Convierte valores de fecha Excel (números seriales o cadenas) a formato DATE
 */
function convertirFecha(valor) {
    if (!valor) return null;
    // Si ya es string, devolverlo tal cual
    if (typeof valor === 'string') return valor;
    // Si es número (fecha serial de Excel), convertir
    if (typeof valor === 'number') {
        const epoch = new Date(1899, 11, 30);
        const fecha = new Date(epoch.getTime() + valor * 86400000);
        return fecha.toISOString().split('T')[0];
    }
    return String(valor);
}

/**
 * Procesa el archivo Excel y guarda las relaciones en DB.
 * Primero elimina todos los registros del usuario, luego inserta los nuevos.
 */
exports.procesarExcel = async function(filePath, usuarioId) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
        throw new Error('El archivo Excel no tiene hojas');
    }

    console.log('[Relaciones] Total filas en Excel:', worksheet.rowCount);
    console.log('[Relaciones] Primera fila (para debug):', worksheet.getRow(1).values);
    console.log('[Relaciones] Segunda fila (para debug):', worksheet.getRow(2).values);

    // Leer encabezados de la fila 1 (asumiendo que no hay título combinado)
    // O probamos fila 2 si la 1 está vacía
    let headerRow = worksheet.getRow(1);
    let firstRowValues = headerRow.values;
    let hasHeadersInRow1 = firstRowValues && firstRowValues.some(v => v && String(v).trim().length > 0);
    
    if (!hasHeadersInRow1) {
        console.log('[Relaciones] Fila 1 vacía, usando fila 2 como headers');
        headerRow = worksheet.getRow(2);
    }

    const headers = [];
    headerRow.eachCell(function(cell) {
        headers.push(String(cell.value || '').trim());
    });

    console.log('[Relaciones] Headers detectados:', headers);
    console.log('[Relaciones] ¿Headers tiene IDENTIFICACIÓN?:', headers.some(h => h.includes('IDENTIFI')));
    console.log('[Relaciones] ¿Headers tiene CLIENTE?:', headers.some(h => h.includes('CLIENTE')));
    console.log('[Relaciones] ¿Headers tiene ESTADO?:', headers.some(h => h.includes('ESTADO')));

    // Empezar desde fila 2 o 3 depende de dónde estén los headers
    const dataStartRow = hasHeadersInRow1 ? 2 : 3;
    console.log('[Relaciones] Empezando a leer datos desde fila:', dataStartRow);

    // Leer datos
    const registros = [];
    const problematicRows = [];
    for (let rowNumber = dataStartRow; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const rowValues = row.values;
        
        // Skip empty rows
        if (!rowValues || !rowValues.some(v => v && String(v).trim().length > 0)) {
            continue;
        }

        const registro = {};
        row.eachCell(function(cell, colNumber) {
            if (colNumber - 1 < headers.length) {
                registro[headers[colNumber - 1]] = cell.value;
            }
        });

        // Debug: mostrar primera fila procesada
        if (registros.length === 0) {
            console.log('[Relaciones] Primera fila de datos:', JSON.stringify(registro));
        }

        // Validar que tenga al menos identificación o cliente
        const idVal = String(registro['IDENTIFICACIÓN'] || registro['IDENTIFICACION'] || '').trim();
        const clienteVal = String(registro['CLIENTE'] || '').trim();
        if (!idVal && !clienteVal) {
            problematicRows.push({ row: rowNumber, reason: 'sin ID ni cliente', data: registro });
            continue; // Saltar filas vacías
        }

        const mapeado = mapearRegistro(registro);

        // Normalizar estado_relacion
        const estado = mapeado.estado_relacion;
        if (estado !== 'ALTA' && estado !== 'BAJA') {
            // Si no es ALTA ni BAJA, intentar inferir
            if (estado.includes('ALTA')) mapeado.estado_relacion = 'ALTA';
            else if (estado.includes('BAJA')) mapeado.estado_relacion = 'BAJA';
            else {
                problematicRows.push({ row: rowNumber, reason: 'estado invalido: ' + estado, data: registro });
                continue; // Saltar registros sin estado válido
            }
        }

        // Convertir fechas
        mapeado.fecha_inicio_relacion = convertirFecha(mapeado.fecha_inicio_relacion);
        mapeado.fecha_fin_relacion = convertirFecha(mapeado.fecha_fin_relacion);
        mapeado.fecha_fin_credito = convertirFecha(mapeado.fecha_fin_credito);
        mapeado.fecha_fin_fidelizacion = convertirFecha(mapeado.fecha_fin_fidelizacion);
        mapeado.proxima_baja = convertirFecha(mapeado.proxima_baja);

        registros.push(mapeado);
    }

    console.log('[Relaciones] Total filas procesadas:', registros.length);
    console.log('[Relaciones] Filas saltadas (problematicas):', problematicRows.slice(0, 5)); // Solo primeras 5

    if (registros.length === 0) {
        return { total: 0, altas: 0, bajas: 0 };
    }

    // Eliminar registros anteriores del usuario
    await pool.query('DELETE FROM relaciones WHERE usuario_id = ?', [usuarioId]);

    // Insertar nuevos registros
    let insertados = 0;
    for (const r of registros) {
        try {
            await pool.query(
                `INSERT INTO relaciones 
                 (usuario_id, identificacion, cliente, celular, estado_relacion,
                  fecha_inicio_relacion, fecha_fin_relacion, fecha_fin_credito,
                  fecha_fin_fidelizacion, proxima_baja, motivo_ruptura, numero_operaciones)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    usuarioId,
                    r.identificacion,
                    r.cliente,
                    r.celular,
                    r.estado_relacion,
                    r.fecha_inicio_relacion,
                    r.fecha_fin_relacion,
                    r.fecha_fin_credito,
                    r.fecha_fin_fidelizacion,
                    r.proxima_baja,
                    r.motivo_ruptura,
                    r.numero_operaciones
                ]
            );
            insertados++;
        } catch (err) {
            console.error('[Relaciones] Error insertando registro:', err.message);
        }
    }

    // Contar altas y bajas
    const countResult = await pool.query(
        'SELECT estado_relacion, COUNT(*) as total FROM relaciones WHERE usuario_id = ? GROUP BY estado_relacion',
        [usuarioId]
    );

    const conteo = (countResult && countResult.rows) ? countResult.rows : [];
    let altas = 0, bajas = 0;
    for (const c of conteo) {
        if (c.estado_relacion === 'ALTA') altas = parseInt(c.total);
        if (c.estado_relacion === 'BAJA') bajas = parseInt(c.total);
    }

    // Limpiar archivo temporal
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    return {
        total: insertados,
        altas: altas,
        bajas: bajas
    };
};
