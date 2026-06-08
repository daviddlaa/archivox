// Funciones del menú hamburguesa
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.menu-overlay');
    sidebar.classList.toggle('movil');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

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
                    body: formData
                }
            );

        const data =
            await response.json();

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
                    href="solicitudes.html"
                    class="btn-ver"
                >
                    📋 Ver Solicitudes →
                </a>

            </div>
        `;

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