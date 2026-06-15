// Historial page - Desktop
// This file is kept for reference but inline JS is now used in historial.html for better caching

var historial = {
    paginaActual: 1,
    limitePorPagina: 50,
    totalRegistros: 0,

    init: function() {
        this.cargar();
    },

    cargar: function() {
        var self = this;
        var offset = (this.paginaActual - 1) * this.limitePorPagina;
        var url = '/api/excel/historial?limite=' + this.limitePorPagina + '&offset=' + offset;
        
        fetch(url, { credentials: 'include' })
            .then(function(response) {
                if (!response.ok) throw new Error('Status: ' + response.status);
                return response.json();
            })
            .then(function(data) {
                self.totalRegistros = data.total;
                self.renderizar(data.data);
                self.actualizarPaginacion();
            })
            .catch(function(error) {
                console.error('Error:', error);
                var tbody = document.getElementById('tablaHistorial');
                if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error: ' + error.message + '</td></tr>';
            });
    },

    renderizar: function(registros) {
        var tbody = document.getElementById('tablaHistorial');
        if (!registros || registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay actualizaciones registradas</td></tr>';
            return;
        }
        var html = '';
        for (var i = 0; i < registros.length; i++) {
            var reg = registros[i];
            var fecha = new Date(reg.fecha_actualizacion).toLocaleString('es-ES');
            var badgeClass = reg.campo === 'estado' ? 'badge-estado' : 'badge-segmento';
            html += '<tr><td>' + reg.solicitud_id + '</td><td><span class="' + badgeClass + '">' + reg.campo + '</span></td><td>' + (reg.valor_anterior || '-') + '</td><td>' + (reg.valor_nuevo || '-') + '</td><td>' + fecha + '</td></tr>';
        }
        tbody.innerHTML = html;
    },

    actualizarPaginacion: function() {
        var totalPaginas = Math.ceil(this.totalRegistros / this.limitePorPagina);
        document.getElementById('totalRegistros').textContent = this.totalRegistros + ' registros';
        document.getElementById('infoPagina').textContent = 'Página ' + this.paginaActual + ' de ' + totalPaginas;
        document.getElementById('btnAnterior').disabled = this.paginaActual === 1;
        document.getElementById('btnSiguiente').disabled = this.paginaActual >= totalPaginas;
    },

    paginaAnterior: function() {
        if (this.paginaActual > 1) {
            this.paginaActual--;
            this.cargar();
        }
    },

    paginaSiguiente: function() {
        var totalPaginas = Math.ceil(this.totalRegistros / this.limitePorPagina);
        if (this.paginaActual < totalPaginas) {
            this.paginaActual++;
            this.cargar();
        }
    }
};

// Auto-init
setTimeout(function() { historial.init(); }, 100);
