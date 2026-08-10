var fs = require('fs');
var c = fs.readFileSync('public/movil/js/equipo.js', 'utf8');

// Fix 1: The first \\'' (2 backslashes + 2 quotes) -> \'' (1 backslash + 2 quotes)
// This is in the verCampanasAgente, editarAgente, resetPasswordAgente, toggleActivoAgente lines
// Pattern: ', \\'' -> ', \''
c = c.replace(/, \\\\''/g, ", \\'");

// Fix 2: The last \\' (2 backslashes + 1 quote) at end of onclick -> \' (1 backslash + 1 quote)
// Fix for: + '\\')\"> -> + '\')\">
c = c.replace(/' \\\\'\)\\">'/g, "' \\')\\\">'");

// Fix 3: '\\' (2 backslashes) in editarAgente line -> '\' (1 backslash)  
// Pattern: username) + '\\' + -> username) + '\' + 
c = c.replace(/username\) \+ '\\\\' \+/g, "username) + '\\' +");

fs.writeFileSync('public/movil/js/equipo.js', c);
console.log('Fixed!');
