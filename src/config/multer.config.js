const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear carpeta uploads/ si no existe
const uploadsDir = 'uploads/';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('DEBUG: Carpeta uploads/ creada automáticamente');
}

// ================== UPLOAD PARA IMÁGENES ==================
const storageImagenes = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});

// Filter to only accept images
const imageFileFilter = function(req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes: jpg, jpeg, png, webp'));
    }
};

// Upload para imágenes (utilizado por /upload-imagen)
const uploadImagenes = multer({
    storage: storageImagenes,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: imageFileFilter
});

// ================== UPLOAD PARA EXCEL ==================
const storageExcel = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'excel-' + uniqueSuffix + ext);
    }
});

// Filter to only accept Excel files
const excelFileFilter = function(req, file, cb) {
    const allowedTypes = /xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (extname) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos Excel: xlsx, xls'));
    }
};

// Upload para Excel (utilizado por /upload)
const uploadExcel = multer({
    storage: storageExcel,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit para Excel
    },
    fileFilter: excelFileFilter
});

// Exportar ambos
module.exports = {
    imagenes: uploadImagenes,
    excel: uploadExcel
};
