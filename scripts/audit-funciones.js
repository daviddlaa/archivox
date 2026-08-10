/**
 * Auditoría refinada de funciones en HTML onclick
 * Busca funciones llamadas desde HTML que no estén definidas en ningún JS del proyecto
 */
const fs = require('fs');
const path = require('path');

const frontendJsFiles = [
  'public/js/login.js', 'public/js/dashboard.js',
  'public/js/notificaciones-dashboard.js', 'public/js/perfil.js',
  'public/desktop/js/dashboard.js', 'public/desktop/js/drawer.js',
  'public/desktop/js/gestion-lote.js', 'public/desktop/js/gestiones.js',
  'public/desktop/js/historial.js', 'public/desktop/js/importar.js',
  'public/desktop/js/relaciones.js', 'public/desktop/js/solicitudes.js',
  'public/desktop/js/ventas.js',
  'public/movil/js/dashboard.js', 'public/movil/js/drawer.js',
  'public/movil/js/gestion-lote.js', 'public/movil/js/gestiones.js',
  'public/movil/js/historial.js', 'public/movil/js/importar.js',
  'public/movil/js/relaciones.js', 'public/movil/js/solicitudes.js',
  'public/movil/js/ventas.js',
  'public/admin/js/admin.js'
];

function readFile(fp) {
  try { return fs.readFileSync(fp, 'utf-8'); } catch (e) { return null; }
}

// Extraer TODAS las definiciones de funciones de TODOS los JS
const allDefs = new Set();
for (const jsFile of frontendJsFiles) {
  const content = readFile(jsFile);
  if (!content) continue;
  const patterns = [
    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    /async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function/g,
  ];
  for (const pattern of patterns) {
    let m; while ((m = pattern.exec(content)) !== null) allDefs.add(m[1]);
  }
}

// Funciones externas conocidas
const externas = new Set([
  'alert', 'confirm', 'prompt', 'fetch', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'encodeURIComponent', 'decodeURIComponent',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'addEventListener',
  'removeEventListener', 'console', 'Drawer',
  'XLSX', 'Chart', 'Swal', 'SweetAlert',
  'EventSource', 'IntersectionObserver', 'FormData', 'Blob', 'URL',
  'sessionStorage', 'localStorage', 'scrollTo', 'open', 'close',
  'Math', 'JSON', 'RegExp', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Map', 'Set'
]);

// Funciones comunes que están en librerías CDN
const cdnFunctions = new Set(['mostrarConfigMetas', 'guardarConfigBonos']);

// Escanear HTML
const htmlFiles = [
  'public/index.html', 'public/perfil.html',
  'public/admin/index.html',
  'public/desktop/solicitudes.html', 'public/desktop/gestiones.html',
  'public/desktop/relaciones.html', 'public/desktop/ventas.html',
  'public/desktop/index.html', 'public/desktop/importar.html',
  'public/desktop/historial.html', 'public/desktop/gestion-lote.html',
  'public/desktop/login.html',
  'public/movil/solicitudes.html', 'public/movil/gestiones.html',
  'public/movil/relaciones.html', 'public/movil/ventas.html',
  'public/movil/index.html', 'public/movil/importar.html',
  'public/movil/historial.html', 'public/movil/gestion-lote.html',
  'public/movil/login.html',
];

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   AUDITORÍA DE FUNCIONES EN HTML onclick/oninput/onchange     ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

let totalIssues = 0;

for (const htmlFile of htmlFiles) {
  const html = readFile(htmlFile);
  if (!html) continue;

  const funcsHtml = new Set();
  const patterns = [
    /onclick="\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    /oninput="\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    /onchange="\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
  ];
  for (const pat of patterns) {
    let m; while ((m = pat.exec(html)) !== null) funcsHtml.add(m[1]);
  }

  const missing = [];
  for (const func of funcsHtml) {
    if (!allDefs.has(func) && !externas.has(func) && !cdnFunctions.has(func)) {
      missing.push(func);
    }
  }

  if (missing.length > 0) {
    totalIssues += missing.length;
    console.log(`📄 ${htmlFile}`);
    for (const func of missing) {
      console.log(`   🔴 ${func}() — no encontrada en ningún JS del proyecto`);
    }
    console.log();
  }
}

if (totalIssues === 0) {
  console.log('✅  Todas las funciones referenciadas en HTML existen en algún JS.\n');
} else {
  console.log(`🔴 ${totalIssues} funciones referenciadas en HTML no encontradas.\n`);
}

// --- ANÁLISIS ADICIONAL: JS files con llamadas a funciones del mismo proyecto ---
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   FUNCIONES LLAMADAS DENTRO DE JS (que no existen)             ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

let totalMissingJs = 0;

for (const jsFile of frontendJsFiles) {
  const content = readFile(jsFile);
  if (!content) continue;

  // Extraer definiciones solo de este archivo
  const fileDefs = new Set();
  const patterns = [
    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    /async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function/g,
  ];
  for (const pat of patterns) {
    let m; while ((m = pat.exec(content)) !== null) fileDefs.add(m[1]);
  }

  // Extraer posibles llamadas a funciones propias (nombres CamelCase)
  const llamadas = new Set();
  const regex = /(?<![.\w$])([a-z][a-zA-Z0-9_]*)\s*\(/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const name = m[1];
    if (!externas.has(name) && name !== 'e' && name !== 'i' && name !== 'j' && name !== 'x' && name !== 'y' &&
        !['if','for','while','switch','catch','typeof','delete','void','new',
          'this','throw','try','do','in','of','case','break','continue',
          'default','finally','return','typeof','instanceof'].includes(name)) {
      llamadas.add(name);
    }
  }

  const missing = [];
  for (const func of llamadas) {
    if (!fileDefs.has(func) && !allDefs.has(func)) {
      missing.push(func);
    }
  }

  if (missing.length > 0) {
    totalMissingJs += missing.length;
    console.log(`📄 ${jsFile}`);
    for (const func of missing) {
      console.log(`   ⚠️  ${func}() — llamada pero no definida globalmente`);
    }
    console.log();
  }
}

if (totalMissingJs === 0) {
  console.log('✅  No hay llamadas a funciones inexistentes en JS.\n');
} else {
  console.log(`⚠️  ${totalMissingJs} posibles funciones no definidas (revisar falsos positivos).\n`);
}

console.log('✅  Auditoría completada.');
