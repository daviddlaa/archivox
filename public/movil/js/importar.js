// Importar móvil - versión completa
document.getElementById('formExcel')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const files = document.getElementById('excelFiles').files;
    const btn = e.target.querySelector('button');
    const msg = document.getElementById('mensaje');
    
    if (files.length === 0) {
        msg.innerHTML = '<div class="msg error">Selecciona al menos un archivo</div>';
        return;
    }
    
    // Mostrar animación de loading
    btn.disabled = true;
    btn.textContent = '⏳ Subiendo...';
    
    // Mostrar archivos seleccionados
    let htmlInfo = '<div class="msg info"><strong>' + files.length + '</strong> archivo(s) seleccionado(s)<br><br>';
    for (const f of files) {
        htmlInfo += '📄 ' + f.name + '<br>';
    }
    htmlInfo += '</div>';
    msg.innerHTML = htmlInfo + '<div class="msg loading">Procesando...</div>';
    
    const formData = new FormData();
    for (const f of files) formData.append('excelFiles', f);
    
    try {
const res = await fetch('/api/excel/upload', { method: 'POST', body: formData, credentials: 'include' });
        const data = await res.json();
        
        if (res.ok) {
            msg.innerHTML = '<div class="msg success">' +
                '<strong>✓ Importación completada</strong><br><br>' +
                '📂 Archivos: <strong>' + data.archivos + '</strong><br>' +
                '📊 Registros: <strong>' + data.registros + '</strong>' +
                '</div>';
            // Limpiar formulario
            document.getElementById('excelFiles').value = '';
        } else {
            msg.innerHTML = '<div class="msg error">✗ ' + data.error + '</div>';
        }
    } catch (err) {
        msg.innerHTML = '<div class="msg error">Error al subir archivos</div>';
    }
    
    btn.disabled = false;
    btn.textContent = 'Subir Archivos';
});

// Listener para mostrar archivos seleccionados al elegirlos
document.getElementById('excelFiles')?.addEventListener('change', function() {
    const msg = document.getElementById('mensaje');
    const files = this.files;
    
    if (!files.length) {
        msg.innerHTML = '';
        return;
    }
    
    let html = '<div class="msg info"><strong>' + files.length + '</strong> archivo(s) seleccionado(s)<br><br>';
    for (const f of files) {
        html += '📄 ' + f.name + '<br>';
    }
    html += '</div>';
    msg.innerHTML = html;
});
