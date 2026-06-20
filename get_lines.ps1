$lines = Get-Content "c:\Users\david\Desktop\Archivox\src\controllers\excel.controller.js"
$start = 623
$end = 650
for ($i = $start; $i -le $end; $i++) {
    Write-Host "$i`: $($lines[$i])"
}
