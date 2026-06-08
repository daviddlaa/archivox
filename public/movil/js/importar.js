// Importar móvil v2
document.getElementById('formExcel')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const files = document.getElementById('excelFiles').files;
    const btn = e.target.querySelector('button');
    const msg = document.getElementById('mensaje');
    
    if (files.length === 0) {
        msg.innerHTML = '<div class="msg error">Selecciona al menos un archivo</div>';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Subiendo...';
    msg.innerHTML = '<div class="msg loading">Subiendo archivos...</div>';
    
    const formData = new FormData();
    for (const f of files) formData.append('excelFiles', f);
    
    try {
        const res = await fetch('/api/excel/importar', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.success) {
            msg.innerHTML = '<div class="msg success">✓ ' + data.message + ' (' + data.registros + ' registros)</div>';
            document.getElementById('excelFiles').value = '';
        } else {
            msg.innerHTML = '<div class="msg error">✗ ' + data.message + '</div>';
        }
    } catch (err) {
        msg.innerHTML = '<div class="msg error">Error al subir archivos</div>';
    }
    
    btn.disabled = false;
    btn.textContent = 'Subir Archivos';
});
