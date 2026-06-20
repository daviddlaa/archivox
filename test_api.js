var http = require('http');

// Test the API endpoint
var options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/excel/gestiones/todas?limite=50&offset=0',
    method: 'GET',
    headers: {
        // Simulate authenticated cookie
        'Cookie': 'connect.sid=test-session'
    }
};

var req = http.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
    });
});

req.on('error', function(e) {
    console.log('Error:', e.message);
});

req.end();
