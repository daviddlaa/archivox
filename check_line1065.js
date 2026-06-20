var fs = require('fs');
var content = fs.readFileSync('./src/controllers/excel.controller.js', 'utf8');
var lines = content.split('\n');
for (var i = 1065; i < 1100; i++) {
    console.log((i+1) + ': ' + lines[i]);
}
