/* Inspección del drawer: usuario normal vs líder vs superadmin (SQLite local) */
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
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        const consoleErrors = [];
        page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
        page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

        try {
            // Login
            await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 20000 });
            await page.waitForSelector('form, input[type=password], #loginForm, [name=password]', { timeout: 10000 }).catch(() => {});
            // Intentar llenar cualquier input de usuario/password
            const filled = await page.evaluate(({ username, password }) => {
                const inputs = Array.from(document.querySelectorAll('input'));
                const userInput = inputs.find(i => /user|usuario|email/i.test(i.name + i.id + i.placeholder)) || inputs[0];
                const passInput = inputs.find(i => i.type === 'password') || inputs[1];
                let ok = false;
                if (userInput && passInput) {
                    userInput.value = username;
                    passInput.value = password;
                    ok = true;
                }
                return { ok, userFound: !!userInput, passFound: !!passInput };
            }, { username: u.username, password: u.password });
            console.log(u.label, 'form fill:', JSON.stringify(filled));

            // Submit
            await page.evaluate(() => {
                const form = document.querySelector('form');
                if (form && form.requestSubmit) form.requestSubmit();
                else {
                    const btn = document.querySelector('button[type=submit], input[type=submit], .btn-primary, button');
                    if (btn) btn.click();
                }
            });
            await sleep(3000);
            console.log(u.label, 'URL after login:', page.url());

            // Navegar al dashboard raiz (si redirige a admin, ir a /)
            if (page.url().includes('/admin')) {
                await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 15000 });
            }
            await sleep(1500);

            // Abrir drawer
            await page.evaluate(() => { const t = document.getElementById('drawer-toggle'); if (t) t.click(); });
            await sleep(800);

            const data = await page.evaluate(() => {
                const drawer = document.getElementById('drawer');
                const overlay = document.getElementById('drawer-overlay');
                const nav = document.querySelector('.drawer-nav');
                const footer = document.querySelector('.drawer-footer');
                const toggle = document.getElementById('drawer-toggle');
                const links = Array.from(document.querySelectorAll('.drawer .drawer-link')).map(a => ({
                    text: a.textContent.trim().replace(/\s+/g, ' '),
                    href: a.getAttribute('href'),
                    display: getComputedStyle(a.parentElement).display,
                    id: a.id || ''
                }));
                const sections = Array.from(document.querySelectorAll('.drawer .drawer-section')).map(s => ({
                    h3: (s.querySelector('h3') || {}).textContent || '',
                    items: Array.from(s.querySelectorAll('.drawer-link')).map(a => a.textContent.trim().replace(/\s+/g, ' '))
                }));
                const rect = drawer ? drawer.getBoundingClientRect() : null;
                const footerRect = footer ? footer.getBoundingClientRect() : null;
                const navRect = nav ? nav.getBoundingClientRect() : null;
                return {
                    drawerOpen: drawer ? drawer.classList.contains('open') : null,
                    drawerRect: rect ? { top: rect.top, bottom: rect.bottom, height: rect.height, width: rect.width } : null,
                    navRect: navRect ? { top: navRect.top, bottom: navRect.bottom, height: navRect.height } : null,
                    navScroll: nav ? { clientHeight: nav.clientHeight, scrollHeight: nav.scrollHeight, overflowY: getComputedStyle(nav).overflowY } : null,
                    footerRect: footerRect ? { top: footerRect.top, bottom: footerRect.bottom, height: footerRect.height } : null,
                    footerAtBottom: footerRect && rect ? (Math.abs(footerRect.bottom - rect.bottom) < 4) : null,
                    footerDisplay: footer ? getComputedStyle(footer).display : null,
                    sections,
                    links,
                    liderLinkDisplay: (() => { const el = document.getElementById('liderEquipoLink'); return el ? getComputedStyle(el).display : 'no-existe'; })(),
                    adminLinkDisplay: (() => { const el = document.getElementById('adminLink'); return el ? getComputedStyle(el).display : 'no-existe'; })(),
                    bodyOverflow: document.body.style.overflow
                };
            });

            await page.screenshot({ path: path.join(__dirname, u.label + '_drawer.png') });
            // Pantalla completa sin drawer (para referencia)
            await page.evaluate(() => { const t = document.getElementById('drawer-toggle'); if (t) t.click(); });
            await sleep(400);
            await page.screenshot({ path: path.join(__dirname, u.label + '_closed.png') });

            report[u.label] = { url: page.url(), data, consoleErrors };
        } catch (err) {
            report[u.label] = { error: err.message, consoleErrors };
        }
        await page.close();
    }

    await browser.close();
    fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));
    console.log('REPORTE GUARDADO');
    console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
