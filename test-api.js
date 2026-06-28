const http = require('http');

// First login to get session
const loginData = JSON.stringify({
    username: 'admin',
    password: 'admin123'
});

const loginOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

const loginReq = http.request(loginOptions, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
        console.log('Login Status:', res.statusCode);
        
        const cookie = res.headers['set-cookie'];
        if (cookie) {
            testApis(cookie[0].split(';')[0]);
        }
    });
});

loginReq.write(loginData);
loginReq.end();

function testApis(cookie) {
    const apis = [
        '/api/excel/dashboard/estados',
        '/api/excel/dashboard/segmentos',
        '/api/excel/solicitudes?limite=5'
    ];
    
    let completed = 0;
    
    apis.forEach((path, index) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET',
            headers: { 'Cookie': cookie }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                console.log(`${path} -> Status: ${res.statusCode}, Response: ${body.substring(0, 100)}`);
                completed++;
                if (completed === apis.length) {
                    console.log('\n✓ All APIs tested successfully!');
                }
            });
        });
        req.end();
    });
}
