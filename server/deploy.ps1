param(
    [string] $Server = "56759440.ssh.w1.strato.hosting",
    [string] $User = "stu512072182",
    [int] $Port = 22,
    [string] $Webroot = "Seniorenclub",
    [string] $AppPath = "wahlassistent",
    [switch] $SkipUpload
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$deployDir = Join-Path $projectRoot ".deploy\wahlassistent"
# config.local.php (Zugangsdaten) und bilder/ (Originalbelege) liegen nur beim Hoster und bleiben dort.
$apiFiles = @(".htaccess", "config.php", "config.local.example.php", "index.php", "lib.php", "schema.sql")
$sshOpt = "-o UpdateHostKeys=no"
$remoteApp = "${Webroot}/${AppPath}"
$remoteApi = "${remoteApp}/php-api"

function Assert-Success([string] $message) {
    if ($LASTEXITCODE -ne 0) {
        Write-Host $message -ForegroundColor Red
        exit 1
    }
}

Write-Host "Baue App..." -ForegroundColor Cyan
Push-Location $projectRoot
try {
    npm.cmd run build
    Assert-Success "Build fehlgeschlagen."
} finally {
    Pop-Location
}

Write-Host "Bereite Deploy-Paket vor..." -ForegroundColor Cyan
if (Test-Path $deployDir) { Remove-Item -LiteralPath $deployDir -Recurse -Force }
New-Item -ItemType Directory -Path "$deployDir\php-api" | Out-Null
Copy-Item -Path "$projectRoot\dist\*" -Destination $deployDir -Recurse -Force
# Die API liest daraus, welche Kalibrierung gilt - wie der Browser.
Copy-Item -Path "$projectRoot\configuration.js" -Destination $deployDir -Force
foreach ($file in $apiFiles) {
    Copy-Item -Path (Join-Path $PSScriptRoot $file) -Destination "$deployDir\php-api" -Force
}

if ($SkipUpload) {
    Write-Host "Upload uebersprungen. Paket liegt in $deployDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "Bereinige Zielverzeichnis..." -ForegroundColor Cyan
ssh -p $Port $sshOpt "${User}@${Server}" "mkdir -p '${remoteApi}' && find '${remoteApp}' -mindepth 1 -maxdepth 1 ! -name 'php-api' -exec rm -rf -- {} \; && find '${remoteApi}' -mindepth 1 -maxdepth 1 ! -name 'config.local.php' ! -name 'bilder' -exec rm -rf -- {} \;"
Assert-Success "Zielverzeichnis konnte nicht vorbereitet werden."

Write-Host "Lade Frontend hoch..." -ForegroundColor Cyan
$frontend = Get-ChildItem -LiteralPath $deployDir -Force | Where-Object { $_.Name -ne "php-api" } | ForEach-Object { $_.FullName }
scp -r -P $Port $sshOpt @frontend "${User}@${Server}:${remoteApp}/"
Assert-Success "Frontend-Upload fehlgeschlagen."

Write-Host "Lade PHP-API hoch..." -ForegroundColor Cyan
# Dateien einzeln statt "*": scp liesse sonst die .htaccess aus.
$uploadFiles = $apiFiles | ForEach-Object { Join-Path "$deployDir\php-api" $_ }
scp -P $Port $sshOpt @uploadFiles "${User}@${Server}:${remoteApi}/"
Assert-Success "API-Upload fehlgeschlagen."

Write-Host "Setze Dateirechte..." -ForegroundColor Cyan
ssh -p $Port $sshOpt "${User}@${Server}" "find '${remoteApp}' -path '${remoteApi}/bilder' -prune -o -type d -exec chmod 755 {} \; -o -type f -exec chmod 644 {} \;"
Assert-Success "Dateirechte konnten nicht gesetzt werden."

Write-Host "Fertig. Beim ersten Mal php-api/config.local.php anlegen (siehe README)." -ForegroundColor Green
