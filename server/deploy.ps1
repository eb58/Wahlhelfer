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
# bilder/ (Originalbelege) liegt nur beim Hoster und bleibt dort. config.local.php entsteht aus den
# STRATO_DB_*-Eintraegen der .env; fehlen sie, bleibt die Datei beim Hoster unangetastet.
$apiFiles = @(".htaccess", "belege-umbenennen.php", "config.php", "config.local.example.php", "create-user.php", "import-wahllokale.php",
    "index.php", "lib.php", "migration-stimmzettelmeldung.sql", "schema.sql", "wahllokalImport.php")
$sshOpt = "-o UpdateHostKeys=no"
$remoteApp = "${Webroot}/${AppPath}"
$remoteApi = "${remoteApp}/php-api"

function Read-Env([string] $path) {
    $values = @{}
    if (Test-Path $path) {
        foreach ($line in Get-Content -LiteralPath $path -Encoding UTF8) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { $values[$Matches[1]] = $Matches[2] -replace '^([''"])(.*)\1$', '$2' }
        }
    }
    $values
}

function ConvertTo-PhpString([string] $value) {
    "'" + $value.Replace('\', '\\').Replace("'", "\'") + "'"
}

function Write-ConfigLocal([hashtable] $envValues, [string] $path) {
    $port = if ($envValues['STRATO_DB_PORT']) { [int] $envValues['STRATO_DB_PORT'] } else { 3306 }
    $php = @"
<?php
declare(strict_types=1);

// Erzeugt von server/deploy.ps1 aus den STRATO_DB_*-Eintraegen der .env. Nicht von Hand aendern.
return [
    'db' => [
        'host' => $(ConvertTo-PhpString $envValues['STRATO_DB_HOST']),
        'port' => $port,
        'name' => $(ConvertTo-PhpString $envValues['STRATO_DB_NAME']),
        'user' => $(ConvertTo-PhpString $envValues['STRATO_DB_USER']),
        'password' => $(ConvertTo-PhpString $envValues['STRATO_DB_PASSWORD']),
    ],
];

"@
    # Ohne BOM: Bytes vor <?php gingen als Ausgabe an den Browser.
    [System.IO.File]::WriteAllText($path, $php.Replace("`r`n", "`n"), (New-Object System.Text.UTF8Encoding $false))
}

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
# Die API liest daraus, welche Kalibrierung und welches Gebiet gelten - wie der Browser.
# Beide Dateien bringt der Build in dist/ mit.
Copy-Item -Path "$projectRoot\configuration.js" -Destination $deployDir -Force
foreach ($file in $apiFiles) {
    Copy-Item -Path (Join-Path $PSScriptRoot $file) -Destination "$deployDir\php-api" -Force
}

$envValues = Read-Env (Join-Path $projectRoot ".env")
$configLocal = "$deployDir\php-api\config.local.php"
$fehlend = @("STRATO_DB_HOST", "STRATO_DB_NAME", "STRATO_DB_USER", "STRATO_DB_PASSWORD") | Where-Object { !$envValues[$_] }
if ($fehlend.Count -eq 0) {
    Write-ConfigLocal $envValues $configLocal
} elseif ($fehlend.Count -lt 4) {
    Write-Host "In .env fehlt: $($fehlend -join ', ')" -ForegroundColor Red
    exit 1
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
if (Test-Path $configLocal) {
    scp -P $Port $sshOpt $configLocal "${User}@${Server}:${remoteApi}/"
    Assert-Success "Upload der config.local.php fehlgeschlagen."
}

Write-Host "Setze Dateirechte..." -ForegroundColor Cyan
ssh -p $Port $sshOpt "${User}@${Server}" "find '${remoteApp}' -path '${remoteApi}/bilder' -prune -o -type d -exec chmod 755 {} \; -o -type f -exec chmod 644 {} \;"
Assert-Success "Dateirechte konnten nicht gesetzt werden."

# Ohne STRATO_DB_* in der .env fehlt config.local.php nach einem frischen Webspace.
$configVorhanden = ssh -p $Port $sshOpt "${User}@${Server}" "test -f '${remoteApi}/config.local.php' && echo ja || echo nein"
if ($configVorhanden -ne "ja") { Write-Host "WARNUNG: php-api/config.local.php fehlt - die API antwortet mit 500, bis sie angelegt ist (STRATO_DB_* in .env, siehe README)." -ForegroundColor Yellow }

Write-Host "Fertig! https://senioren-luebars.berlin/${AppPath}/controlcenter/" -ForegroundColor Green
