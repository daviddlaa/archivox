require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  try {
    console.log('=== PASO 1: Verificar estado de la BD ===');
    
    // 1. Pool status
    console.log('Pool totalCount:', pool.totalCount);
    console.log('Pool idleCount:', pool.idleCount);
    console.log('Pool waitingCount:', pool.waitingCount);
    
    // 2. Test connection
    const startConn = Date.now();
    const rConn = await pool.query('SELECT 1 as ok');
    console.log('Conexión OK en', (Date.now() - startConn) + 'ms');
    
    // 3. Verificar que la tabla gestiones_maestro existe y es escribible
    console.log('\n=== PASO 2: Verificar tabla gestiones_maestro ===');
    const r1 = await pool.query("SELECT COUNT(*) as total FROM gestiones_maestro");
    console.log('Total campañas actuales:', r1.rows[0].total);
    
    // 4. Verificar el último ID
    const r2 = await pool.query("SELECT MAX(id) as max_id FROM gestiones_maestro");
    console.log('Último ID de campaña:', r2.rows[0].max_id);
    
    // 5. Simular EXACTAMENTE lo que hace el frontend para Angelica (user_id=2)
    console.log('\n=== PASO 3: Simular creación exacta ===');
    
    // Estos son los IDs que podría enviar el frontend (strings de checkbox values)
    const solicitudes_ids_frontend = ['352684', '440212', '448549'];
    
    // Función normalizarIdsSolicitud (copiada del código)
    function normalizarIdsSolicitud(ids) {
      if (!Array.isArray(ids)) return [];
      var out = [];
      var seen = {};
      for (var i = 0; i < ids.length; i++) {
        var n = Number(ids[i]);
        if (!n || isNaN(n) || seen[n]) continue;
        seen[n] = true;
        out.push(n);
      }
      return out;
    }
    
    const solicitudes_ids = normalizarIdsSolicitud(solicitudes_ids_frontend);
    console.log('IDs normalizados:', solicitudes_ids);
    console.log('Tipo:', typeof solicitudes_ids[0]);
    
    const nombre = 'TEST FORENSE';
    const descripcion = '';
    const usuario_id = 2;
    const equipo_id = 1;
    const fecha_limite = null;
    const asignado_a = null;
    const solicitudesIdsJson = JSON.stringify(solicitudes_ids);
    
    console.log('Parámetros:', { nombre, descripcion, usuario_id, equipo_id, total: solicitudes_ids.length, fecha_limite, solicitudesIdsJson, asignado_a });
    
    // 6. Ejecutar el INSERT exacto
    console.log('\n=== PASO 4: Ejecutar INSERT ===');
    const startInsert = Date.now();
    try {
      const resultGM = await pool.query(
        'INSERT INTO gestiones_maestro (nombre, descripcion, usuario_id, equipo_id, total_solicitudes, gestionadas, fecha_limite, solicitudes_ids, asignado_a) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)',
        [nombre, descripcion, usuario_id, equipo_id, solicitudes_ids.length, fecha_limite, solicitudesIdsJson, asignado_a]
      );
      const gestion_id = resultGM.lastInsertRowid;
      console.log('INSERT OK en', (Date.now() - startInsert) + 'ms, ID:', gestion_id);
      
      // 7. Probar el puente semáforo
      console.log('\n=== PASO 5: Insertar puente semáforo ===');
      const startSemaforo = Date.now();
      for (var i = 0; i < solicitudes_ids.length; i++) {
        await pool.query(
          'INSERT INTO gestiones_maestro_solicitudes (gestion_maestro_id, id_solicitud, semaforo, updated_by) VALUES (?, ?, ?, ?)',
          [gestion_id, solicitudes_ids[i], 'sin_clasificar', usuario_id]
        );
      }
      console.log('Semáforo OK en', (Date.now() - startSemaforo) + 'ms');
      
      // 8. Probar UPDATE campana_id
      console.log('\n=== PASO 6: Actualizar campana_id ===');
      const startUpdate = Date.now();
      const placeholders = solicitudes_ids.map(function() { return '?'; }).join(',');
      await pool.query(
        'UPDATE solicitudes SET campana_id = ? WHERE id_solicitud IN (' + placeholders + ')',
        [gestion_id].concat(solicitudes_ids)
      );
      console.log('campana_id OK en', (Date.now() - startUpdate) + 'ms');
      
      // 9. Probar cache invalidation
      console.log('\n=== PASO 7: Invalidar caché ===');
      try {
        const cache = require('./src/config/cache');
        cache.invalidateAllCampanas();
        console.log('Cache invalidada OK');
      } catch (e) {
        console.log('Error invalidando cache:', e.message);
      }
      
      // 10. Verificar que se creó
      const rVerify = await pool.query('SELECT id, nombre, total_solicitudes, solicitudes_ids FROM gestiones_maestro WHERE id = $1', [gestion_id]);
      console.log('\n=== VERIFICACIÓN FINAL ===');
      console.log('Campaña creada:', JSON.stringify(rVerify.rows[0]));
      
      // LIMPIAR
      console.log('\n=== LIMPIEZA ===');
      await pool.query('DELETE FROM gestiones_maestro_solicitudes WHERE gestion_maestro_id = $1', [gestion_id]);
      await pool.query('UPDATE solicitudes SET campana_id = NULL WHERE campana_id = $1', [gestion_id]);
      await pool.query('DELETE FROM gestiones_maestro WHERE id = $1', [gestion_id]);
      console.log('Limpieza OK');
      
    } catch (e) {
      console.error('\n!!! ERROR DURANTE INSERT !!!');
      console.error('Mensaje:', e.message);
      console.error('Código:', e.code);
      console.error('Detalle:', e.detail);
      console.error('Hint:', e.hint);
      console.error('Position:', e.position);
      console.error('Where:', e.where);
      console.error('Stack:', e.stack);
    }
    
    // PASO 8: Verificar si hay conexiones colgadas
    console.log('\n=== PASO 8: Pool después de la prueba ===');
    console.log('Pool totalCount:', pool.totalCount);
    console.log('Pool idleCount:', pool.idleCount);
    console.log('Pool waitingCount:', pool.waitingCount);
    
    process.exit(0);
  } catch(e) {
    console.error('ERROR GENERAL:', e.message);
    process.exit(1);
  }
})();
