/* Diagnóstico del chequeo de rol en el drawer */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3100';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const USERS = [
    { username: 'normaltest', password: 'Test1234', label: 'NORMAL' },
    { username: 'lidertest', password: 'Test1234', label: 'LIDER' },
    { username: 'admintest', password: 'Test1234', label: 'SUPERADMIN' }
];

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const report = {};

    for (const u of USERS) {
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        const consoleErrors = [];
        page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().substring(0, 200)); });
        page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message.substring(0, 200)));

        try {
            await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 20000 });
            await sleep(1000);
            await page.evaluate(({ username, password }) => {
                const userInput = document.getElementById('username');
                const passInput = document.getElementById('password');
                userInput.value = username;
                passInput.value = password;
                const form = document.getElementById('loginForm');
                form.requestSubmit();
            }, { username: u.username, password: u.password });
            await sleep(3500);
            const urlTrasLogin = page.url();

            // Verificar sesión devuelta por el API
            const sesion = await page.evaluate(async () => {
                try {
                    const r = await fetch('/api/auth/sesion', { credentials: 'include' });
                    const j = await r.json();
                    return { status: r.status, body: j };
                } catch (e) { return { error: e.message }; }
            });

            // Abrir drawer de forma determinista
            await page.waitForSelector('#drawer', { timeout: 5000 }).catch(() => {});
            await page.evaluate(() => { if (window.Drawer && typeof Drawer.open === 'function') Drawer.open(); });
            await sleep(2500); // tiempo de sobra para los fetches de rol

            const drawer = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('.drawer .drawer-link'));
                const estado = {};
                links.forEach(a => {
                    estado[a.id || a.textContent.trim()] = getComputedStyle(a).display;
                });
                return {
                    drawerExiste: !!document.getElementById('drawer'),
                    drawerOpen: document.getElementById('drawer')?.classList.contains('open'),
                    drawerVersion: (window.Drawer || {}).isOpen,
                    estadoLinks: estado,
                    footerBottom: (() => {
                        const d = document.getElementById('drawer').getBoundingClientRect();
                        const f = document.querySelector('.drawer-footer')?.getBoundingClientRect();
                        return f ? Math.abs(f.bottom - d.bottom) < 4 : null;
                    })()
                };
            });

            report[u.label] = { urlTrasLogin, sesion, drawer, consoleErrors };
            console.log(u.label, JSON.stringify({ urlTrasLogin, sesion: { status: sesion.status, autenticado: sesion.body?.autenticado, rol: sesion.body?.usuario?.rol, es_lider: sesion.body?.usuario?.es_lider, is_superadmin: sesion.body?.usuario?.is_superadmin }, drawer, consoleErrors }, null, 2));
        } catch (err) {
            report[u.label] = { error: err.message, consoleErrors };
            console.log(u.label, 'ERROR', err.message);
        }
        await page.close();
        await context.close();
    }

    await browser.close();
    fs.writeFileSync(path.join(__dirname, 'report2.json'), JSON.stringify(report, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
