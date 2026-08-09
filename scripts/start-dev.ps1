# Starts the full dev stack as detached processes (survive terminal close):
#   MySQL (XAMPP), MongoDB, Laravel reference app :8000, MERN API :5000, MERN frontend :5173
$ErrorActionPreference = 'Continue'

$root = "c:\Users\LAPTOPS HUB\Documents\superfans"
$mongoBin = "$env:USERPROFILE\mongodb\mongodb-win32-x86_64-windows-8.0.12\bin\mongod.exe"
$logDir = "$env:USERPROFILE\mongodb"

# MySQL
$mysqlUp = $false
try { & "C:\xampp6\mysql\bin\mysql.exe" -u root -N -e "SELECT 1;" *> $null; $mysqlUp = $LASTEXITCODE -eq 0 } catch {}
if (-not $mysqlUp) {
    Start-Process -FilePath "C:\xampp6\mysql\bin\mysqld.exe" -ArgumentList "--defaults-file=C:\xampp6\mysql\bin\my.ini","--standalone" -WindowStyle Hidden
    Write-Host "MySQL: starting..."
} else { Write-Host "MySQL: already up" }

# MongoDB — path contains a space, so pass a single pre-quoted argument string
if (-not (Get-Process mongod -ErrorAction SilentlyContinue)) {
    $mongoArgs = "--dbpath `"$env:USERPROFILE\mongodb\data`" --port 27017 --logpath `"$logDir\mongod.log`" --logappend"
    Start-Process -FilePath $mongoBin -ArgumentList $mongoArgs -WindowStyle Hidden
    Write-Host "MongoDB: starting..."
} else { Write-Host "MongoDB: already up" }

function Test-Port($port) {
    # vite binds IPv6 ::1, others IPv4 — 'localhost' tries both
    try { (New-Object Net.Sockets.TcpClient('localhost', $port)).Close(); return $true } catch { return $false }
}

# Laravel reference app :8000
if (-not (Test-Port 8000)) {
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-WindowStyle","Hidden","-Command","Set-Location '$root'; php artisan serve --port=8000" -WindowStyle Hidden
    Write-Host "Laravel :8000 starting..."
} else { Write-Host "Laravel :8000 already up" }

# MERN backend :5000
if (-not (Test-Port 5000)) {
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-WindowStyle","Hidden","-Command","Set-Location '$root\superfans-mern\backend'; npm run dev" -WindowStyle Hidden
    Write-Host "API :5000 starting..."
} else { Write-Host "API :5000 already up" }

# MERN frontend :5173
if (-not (Test-Port 5173)) {
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-WindowStyle","Hidden","-Command","Set-Location '$root\superfans-mern\frontend'; npm run dev" -WindowStyle Hidden
    Write-Host "Frontend :5173 starting..."
} else { Write-Host "Frontend :5173 already up" }

Start-Sleep -Seconds 12
foreach ($check in @(@(27017,'MongoDB'), @(8000,'Laravel'), @(5000,'API'), @(5173,'Frontend'))) {
    $status = if (Test-Port $check[0]) { 'UP' } else { 'DOWN' }
    Write-Host ("{0,-10} :{1}  {2}" -f $check[1], $check[0], $status)
}
