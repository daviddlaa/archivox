var db = require('./src/config/db');
(async function() {
    // Try different spellings
    var tables = ['gestiones', 'gestioness', 'gestioness', 'gestionn', 'gestion'];
    for (var i = 0; i < tables.length; i++) {
        var tbl = tables[i];
        try {
            var result = await db.query('SELECT COUNT(*) as total FROM ' + tbl);
            console.log(tbl + ':', result.rows[0].total);
        } catch(e) {
            console.log(tbl + ' error:', e.message);
        }
    }
    process.exit();
})();
