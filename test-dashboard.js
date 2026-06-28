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
        console.log('Login Response:', body);
        
        // Then test dashboard
        if (res.statusCode === 200) {
            const cookie = res.headers['set-cookie'];
            if (cookie) {
                testDashboard(cookie[0].split(';')[0]);
            }
        }
    });
});

loginReq.write(loginData);
loginReq.end();

function testDashboard(cookie) {
    const dashboardOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/excel/dashboard',
        method: 'GET',
        headers: {
            'Cookie': cookie
        }
    };
    
    const req = http.request(dashboardOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            console.log('\nDashboard Status:', res.statusCode);
            console.log('Dashboard Response:', body);
        });
    });
    
    req.end();
}
