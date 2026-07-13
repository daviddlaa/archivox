var fs = require('fs');
var c = fs.readFileSync('public/movil/js/equipo.js', 'utf8');

// Fix all broken escaping patterns in the 4 onclick lines
// The file has \\'' (2 backslashes + 2 quotes) where it should have \'' (1 backslash + 2 quotes)
// \'' in single-quoted JS: \' = escaped quote = ', ' = close string -> value: '
// \\'' in single-quoted JS: \\ = escaped backslash = \, ' = close, ' = empty -> value: \ + empty = \

// Strategy: Replace the entire button HTML lines with correct versions

// 1. verCampanasAgente
var v1 = "verCampanasAgente(' + agente.id + ', \\\\'' + escapeHtmlMovil(agente.username) + '\\\\')\">";
var v2 = "verCampanasAgente(' + agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\')\">";
c = c.split(v1).join(v2);

// 2. editarAgente
var e1 = "editarAgente(' + agente.id + ', \\\\'' + escapeHtmlMovil(agente.username) + '\\\\'' + ', \\\\'' + escapeHtmlMovil(agente.nombre || '') + '\\\\')\">";
var e2 = "editarAgente(' + agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\'' + ', \\'' + escapeHtmlMovil(agente.nombre || '') + '\\')\">";
c = c.split(e1).join(e2);

// 3. resetPasswordAgente  
var r1 = "resetPasswordAgente(' + agente.id + ', \\\\'' + escapeHtmlMovil(agente.username) + '\\\\')\">";
var r2 = "resetPasswordAgente(' + agente.id + ', \\'' + escapeHtmlMovil(agente.username) + '\\')\">";
c = c.split(r1).join(r2);

// 4. toggleActivoAgente
var t1 = "toggleActivoAgente(' + agente.id + ', ' + (activo ? 'false' : 'true') + ', \\\\'' + escapeHtmlMovil(agente.username) + '\\\\')\">";
var t2 = "toggleActivoAgente(' + agente.id + ', ' + (activo ? 'false' : 'true') + ', \\'' + escapeHtmlMovil(agente.username) + '\\')\">";
c = c.split(t1).join(t2);

fs.writeFileSync('public/movil/js/equipo.js', c);
console.log('Fixed!');
