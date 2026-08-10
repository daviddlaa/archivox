var fs = require('fs');
var c = fs.readFileSync('public/movil/js/equipo.js', 'utf8');

// Fix all 4 onclick lines. The correct escaping is \' (backslash + quote)
// which in a single-quoted JS string means an escaped single quote character.

// Fix 1: verCampanasAgente - replace broken escaping
// Current: ', \\' + escapeHtmlMovil(agente.username) + '\\'
// Should:  ', \'' + escapeHtmlMovil(agente.username) + '\''
// Note: In the file, \\ means TWO backslash chars. We need ONE.
var old1 = "verCampanasAgente(' + agente.id + ', \\' + escapeHtmlMovil(agente.username) + '\\'";
var new1 = "verCampanasAgente(' + agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\'";
if (c.indexOf(old1) >= 0) {
  c = c.split(old1).join(new1);
  console.log('Fix 1 applied (verCampanasAgente)');
} else {
  console.log('Fix 1 NOT FOUND, searching...');
  var idx = c.indexOf('verCampanasAgente');
  if (idx >= 0) console.log('Context: ' + JSON.stringify(c.substring(idx, idx+120)));
}

// Fix 2: editarAgente - this one is complex, replace entire button line
var old2 = "agente.id + ', \\' + escapeHtmlMovil(agente.username) + '\\'' + ', \\'' + escapeHtmlMovil(agente.nombre || '') + '\\\\')\">";
var new2 = "agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\'' + ', \\'' + escapeHtmlMovil(agente.nombre || '') + '\\')\">";
if (c.indexOf(old2) >= 0) {
  c = c.split(old2).join(new2);
  console.log('Fix 2 applied (editarAgente)');
} else {
  console.log('Fix 2 NOT FOUND');
  var idx = c.indexOf('editarAgente(');
  if (idx >= 0) console.log('editarAgente context: ' + JSON.stringify(c.substring(idx, idx+200)));
}

// Fix 3: resetPasswordAgente
var old3 = "resetPasswordAgente(' + agente.id + ', \\' + escapeHtmlMovil(agente.username) + '\\'";
var new3 = "resetPasswordAgente(' + agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\'";
if (c.indexOf(old3) >= 0) {
  c = c.split(old3).join(new3);
  console.log('Fix 3 applied (resetPasswordAgente)');
} else {
  console.log('Fix 3 NOT FOUND');
  var idx = c.indexOf('resetPasswordAgente');
  if (idx >= 0) console.log('Context: ' + JSON.stringify(c.substring(idx, idx+120)));
}

// Fix 4: toggleActivoAgente
var old4 = "toggleActivoAgente(' + agente.id + ', ' + (activo ? 'false' : 'true') + ', \\' + escapeHtmlMovil(agente.username) + '\\'";
var new4 = "toggleActivoAgente(' + agente.id + ', ' + (activo ? 'false' : 'true') + ', \\'' + escapeHtmlMovil(agente.username) + '\\'";
if (c.indexOf(old4) >= 0) {
  c = c.split(old4).join(new4);
  console.log('Fix 4 applied (toggleActivoAgente)');
} else {
  console.log('Fix 4 NOT FOUND');
  var idx = c.indexOf('toggleActivoAgente(');
  if (idx >= 0) console.log('Context: ' + JSON.stringify(c.substring(idx, idx+150)));
}

fs.writeFileSync('public/movil/js/equipo.js', c);
console.log('Done writing file');
