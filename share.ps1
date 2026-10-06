# =====================================================================
# Global Hero Registration Authority Management System (GHRMS)
# Network Sharing & Field Sentinel Checkpoint Terminal (Windows PowerShell)
# =====================================================================

$ErrorActionPreference = "Stop"

$port = if ($env:PORT) { $env:PORT } else { "8000" }

# Refresh PATH to locate PHP
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$phpCmd = Get-Command php -ErrorAction SilentlyContinue
if (-not $phpCmd) {
    # Check winget standard location
    $wingetPhp = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"
    if (Test-Path $wingetPhp) {
        $env:Path = (Split-Path $wingetPhp) + ";" + $env:Path
        $phpCmd = Get-Command php -ErrorAction SilentlyContinue
    }
}

if (-not $phpCmd) {
    Write-Host "ERROR: PHP is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Run 'winget install PHP.PHP.8.3' or install PHP 8.2+ to continue." -ForegroundColor Yellow
    exit 1
}

# Find local IPv4 address
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -ExpandProperty IPAddress -First 1)

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "   GLOBAL HERO REGISTRATION AUTHORITY (GHRMS) // FIELD SHARING GATEWAY" -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Local Machine:  http://localhost:${port}/login" -ForegroundColor Green
if ($localIp) {
    Write-Host "LAN Access:     http://${localIp}:${port}/login" -ForegroundColor Green
    Write-Host "Field Scanner:  http://${localIp}:${port}/sentinel (Sentinel Checkpoint Scanner)" -ForegroundColor Yellow
}
Write-Host "================================================================================" -ForegroundColor Cyan

# Preflight check
php check_system.php
if ($LASTEXITCODE -ne 0) {
    Write-Host "Diagnostic check failed. Please resolve issues above." -ForegroundColor Red
    exit 1
}

Write-Host "`nStarting GHRMS on 0.0.0.0:${port} for LAN/Mobile access..." -ForegroundColor Cyan
php -S 0.0.0.0:${port} router.php
