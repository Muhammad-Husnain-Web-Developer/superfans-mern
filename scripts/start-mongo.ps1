# Starts the portable MongoDB server for local development.
# One-time setup: download mongodb-windows-x86_64 zip from
# https://www.mongodb.com/try/download/community and extract to %USERPROFILE%\mongodb

$mongoRoot = Get-ChildItem "$env:USERPROFILE\mongodb" -Directory |
    Where-Object Name -like "mongodb-win32*" |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $mongoRoot) {
    Write-Error "MongoDB not found under $env:USERPROFILE\mongodb — see comment at top of this script."
    exit 1
}

$dataDir = "$env:USERPROFILE\mongodb\data"
New-Item -ItemType Directory -Force $dataDir | Out-Null

if (Get-Process mongod -ErrorAction SilentlyContinue) {
    Write-Host "mongod is already running."
    exit 0
}

Write-Host "Starting mongod (data: $dataDir)..."
& "$mongoRoot\bin\mongod.exe" --dbpath $dataDir --port 27017
