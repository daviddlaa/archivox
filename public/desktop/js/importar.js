const form = document.getElementById('formExcel');
const mensaje = document.getElementById('mensaje');

const inputArchivos =
    document.getElementById('excelFiles');

const btnSubir =
    document.querySelector('button');

inputArchivos.addEventListener('change', () => {

    if (!inputArchivos.files.length) {

        mensaje.innerHTML = '';

        return;
    }

    let html = `
        <div class="info">
            <strong>
                ${inputArchivos.files.length}
            </strong>
            archivo(s) seleccionado(s)
            <br><br>
    `;

    for (const archivo of inputArchivos.files) {

       html += `
            <div class="archivo">
                📄 ${archivo.name}
            </div>
        `;

    }

    html += '</div>';

    mensaje.innerHTML = html;

});

form.addEventListener('submit', async (e) => {

    e.preventDefault();

    const archivos =
        inputArchivos.files;

    if (!archivos.length) {

        alert(
            'Seleccione al menos un archivo'
        );

        return;
    }

    const formData = new FormData();

    for (const archivo of archivos) {

        formData.append(
            'excelFiles',
            archivo
        );

    }

    btnSubir.disabled = true;

    mensaje.innerHTML = `
        <div class="loading">
            ⏳ Procesando archivos...
        </div>
    `;

    try {

        const response =
            await fetch(
                '/api/excel/upload',
                {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                }
            );

        const data =
            await response.json();

        // Verificar si hay actualizaciones
        if (data.updates && data.updates > 0) {
            
            // Construir tabla de actualizaciones
            let tablaHTML = `
                <div class="update-report">
                    <h3>📝 Informe de Actualización</h3>
                    <p class="summary">
                        <strong>${data.updates}</strong> registro(s) actualizado(s)
                        <br>
                        <strong>${data.inserts}</strong> registro(s) nuevo(s)
                    </p>
                    <div class="table-container">
                        <table class="update-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Campo</th>
                                    <th>Anterior</th>
                                    <th>Nuevo</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            // Agregar cada detalle
            if (data.detalles && data.detalles.length > 0) {
                for (const detalle of data.detalles) {
                    tablaHTML += `
                        <tr>
                            <td>${detalle.id}</td>
                            <td>${detalle.campo === 'estado' ? 'Estado' : 'Segmento'}</td>
                            <td>${detalle.anterior || '-'}</td>
                            <td>${detalle.nuevo || '-'}</td>
                        </tr>
                    `;
                }
            }
            
            tablaHTML += `
                            </tbody>
                        </table>
                    </div>
<a href="/solicitudes" class="btn-ver">
                        📋 Ver Solicitudes →
                    </a>
                </div>
            `;
            
            mensaje.innerHTML = tablaHTML;
            
        } else {
            
            //Primera carga - informe simple
            mensaje.innerHTML = `
                <div class="success">

                    <h3>✅ Importación completada</h3>

                    <p>
                        📂 Archivos procesados:
                        <strong>${data.archivos}</strong>
                    </p>

                    <p>
                        📊 Registros importados:
                        <strong>${data.registros}</strong>
                    </p>

<a
                        href="/solicitudes"
                        class="btn-ver"
                    >
                        📋 Ver Solicitudes →
                    </a>

                </div>
            `;
            
        }

        form.reset();

    } catch (error) {

        console.error(error);

        mensaje.innerHTML = `
            <div class="error">
                ❌ Error al importar
            </div>
        `;

    } finally {

        btnSubir.disabled = false;

    }

});
