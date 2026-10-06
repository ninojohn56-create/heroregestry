# =====================================================================
# Global Hero Registration Authority Management System (GHRMS)
# Primary Windows Startup Script (PowerShell)
# =====================================================================

$ErrorActionPreference = "Stop"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "   GLOBAL HERO REGISTRATION AUTHORITY (GHRMS) // SYSTEM LAUNCHER" -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan

# Refresh Environment PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Locate PHP with broad auto-discovery across common environments
$phpCmd = Get-Command php -ErrorAction SilentlyContinue
if (-not $phpCmd) {
    $candidatePaths = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe",
        "C:\xampp\php\php.exe",
        "C:\php\php.exe",
        "C:\tools\php\php.exe",
        "C:\Program Files\PHP\php.exe",
        "C:\Program Files (x86)\PHP\php.exe",
        "D:\xampp\php\php.exe",
        "D:\php\php.exe"
    )
    
    # Also check dynamic folders for Laragon and WAMP
    if (Test-Path "C:\laragon\bin\php") {
        $laragonPhp = Get-ChildItem "C:\laragon\bin\php" -Filter "php.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($laragonPhp) { $candidatePaths += $laragonPhp.FullName }
    }
    if (Test-Path "C:\wamp64\bin\php") {
        $wampPhp = Get-ChildItem "C:\wamp64\bin\php" -Filter "php.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($wampPhp) { $candidatePaths += $wampPhp.FullName }
    }

    foreach ($candidate in $candidatePaths) {
        if (Test-Path $candidate) {
            $dir = Split-Path $candidate
            $env:Path = "$dir;" + $env:Path
            $phpCmd = Get-Command php -ErrorAction SilentlyContinue
            if ($phpCmd) {
                Write-Host "[INFO] Detected PHP at: $candidate" -ForegroundColor Green
                break
            }
        }
    }
}

if (-not $phpCmd) {
    Write-Host "`n[ERROR] PHP 8.2+ runtime was not found on your system." -ForegroundColor Red
    Write-Host "Please install PHP via winget by running:" -ForegroundColor Yellow
    Write-Host "  winget install PHP.PHP.8.3" -ForegroundColor White
    Write-Host "`nOr use Docker (works on any machine with Docker Desktop):" -ForegroundColor Yellow
    Write-Host "  docker compose up -d" -ForegroundColor White
    Write-Host "`nOr install XAMPP / PHP manually and add it to your system PATH." -ForegroundColor Gray
    Read-Host "`nPress Enter to exit..."
    exit 1
}

$port = if ($env:PORT) { $env:PORT } else { "8000" }

# Run System Diagnostic Preflight
Write-Host "`n[1/3] Running preflight system diagnostics..." -ForegroundColor Cyan
php check_system.php
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[FAIL] Preflight diagnostics failed. Please resolve above issues before starting." -ForegroundColor Red
    Read-Host "`nPress Enter to exit..."
    exit 1
}

# Verify Datastore Seeding
Write-Host "`n[2/3] Checking datastore integrity and seed data..." -ForegroundColor Cyan
if (-not (Test-Path "backend\data\heroes.json")) {
    php backend\seed.php
}

# Launching Server
Write-Host "`n[3/3] Starting GHRMS Web Server on http://localhost:${port}..." -ForegroundColor Green
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  Security Clearance Gateway:  http://localhost:${port}/login" -ForegroundColor White
Write-Host "  Sentinel Checkpoint Scanner: http://localhost:${port}/sentinel" -ForegroundColor White
Write-Host "  API Health Diagnostics:      http://localhost:${port}/api/health" -ForegroundColor White
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Default Credentials:" -ForegroundColor Yellow
Write-Host "  Super Admin:  callsign: commander   passkey: admin123" -ForegroundColor White
Write-Host "  Registrar:    callsign: sarah.chen  passkey: registrar123" -ForegroundColor White
Write-Host "  Hero:         callsign: apex        passkey: hero123" -ForegroundColor White
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Server running. Press Ctrl+C in this terminal to shut down.`n" -ForegroundColor DarkCyan

# Open default browser after a brief delay
Start-Process "http://localhost:${port}/login"

# Run PHP built-in server with router.php front controller
php -S 127.0.0.1:${port} router.php
