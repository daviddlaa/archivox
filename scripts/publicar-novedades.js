// ============================================================================
// PUBLICAR NOVEDADES - Envía los anuncios de funcionalidades a producción
// ============================================================================
// ARCHIVOX - Centro de Novedades
//
// Lee los anuncios desde el archivo JSON (UTF-8) y los crea vía la API de
// producción usando fetch de Node 20+. Evita problemas de encoding de la
// terminal de Windows (emojis corruptos al pasar JSON por la línea de comandos).
//
// Uso:
//   node scripts/publicar-novedades.js
// ============================================================================

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.ARCHIVOX_URL || 'https://archivox.onrender.com';
const USERNAME = process.env.ARCHIVOX_USER || 'superadmin';
const PASSWORD = process.env.ARCHIVOX_PASS || '';

const ANUNCIOS_FILE = path.join(__dirname, 'novedades_anuncios.json');

async function main() {
    if (!PASSWORD) {
        console.error('❌ Define ARCHIVOX_PASS (contraseña del superadmin) para continuar.');
        process.exit(1);
    }

    // 1. Login
    console.log(`🔑 Login como ${USERNAME} en ${BASE_URL}...`);
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
        credentials: 'include'
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.mensaje) {
        console.error('❌ Login falló:', loginData.error || loginRes.status);
        process.exit(1);
    }
    console.log('✅ Login exitoso:', loginData.usuario.username);

    // 2. Obtener cookie de sesión
    const setCookie = loginRes.headers.get('set-cookie');
    const cookie = setCookie ? setCookie.split(';')[0] : '';
    if (!cookie) {
        console.error('❌ No se obtuvo cookie de sesión.');
        process.exit(1);
    }

    // 3. Leer anuncios desde el archivo UTF-8
    const anuncios = JSON.parse(fs.readFileSync(ANUNCIOS_FILE, 'utf8'));
    console.log(`📢 Publicando ${anuncios.length} anuncios de novedades...`);

    for (const a of anuncios) {
        const res = await fetch(`${BASE_URL}/api/admin/notificaciones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },
            body: JSON.stringify(a)
        });
        const data = await res.json();
        const ok = res.ok;
        console.log(`${ok ? '✅' : '❌'} [${res.status}] "${a.titulo.slice(0, 50)}" → ${ok ? 'id ' + data.id : data.error}`);
    }

    // 4. Verificar
    console.log('---');
    console.log('🔎 Verificando novedades guardadas...');
    const listRes = await fetch(`${BASE_URL}/api/admin/notificaciones?limite=8`, {
        headers: { 'Cookie': cookie }
    });
    const list = await listRes.json();
    (list.data || []).forEach(n => {
        const tieneEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test((n.titulo || '') + (n.mensaje || ''));
        console.log(`#${n.id} | novedad=${Number(n.es_novedad) === 1 ? 'SI' : 'no'} | emoji=${tieneEmoji ? '✅' : '❌'} | ${(n.titulo || '').slice(0, 45)}`);
    });
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
