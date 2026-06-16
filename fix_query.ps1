$filePath = "c:\Users\david\Desktop\Archivox\src\controllers\excel.controller.js"
$content = Get-Content $filePath -Raw

# Simple line-by-line replacement
$content = $content -replace "ROW_NUMBER\(\) OVER \(PARTITION BY solicitud_id ORDER BY fecha_gestion DESC\) as rn", "DISTINCT ON (solicitud_id)"
$content = $content -replace "FROM \(", "FROM "
$content = $content -replace "SELECT \*,", "SELECT "
$content = $content -replace "\) g\r?\n            WHERE g.rn = 1", ""
$content = $content -replace "\) g\n            WHERE g.rn = 1", ""
$content = $content -replace "SELECT g\.id, g\.solicitud_id", "SELECT id, solicitud_id"
$content = $content -replace "g\.tipo_gestion", "tipo_gestion"
$content = $content -replace "g\.observacion", "observacion"
$content = $content -replace "g\.fecha_gestion", "fecha_gestion"
$content = $content -replace "g\.usuario_id", "usuario_id"

$content | Set-Content $filePath -NoNewline -Encoding UTF8

Write-Host "Fix applied!"
