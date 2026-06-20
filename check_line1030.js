var fs = require('fs');
var content = fs.readFileSync('./src/controllers/excel.controller.js', 'utf8');
var lines = content.split('\n');
for (var i = 1025; i < 1060; i++) {
    console.log((i+1) + ': ' + lines[i]);
}
