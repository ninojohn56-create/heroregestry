# =====================================================================
# Global Hero Registration Authority (GHRMS) // Worldwide Access Launcher
# Allows your friends anywhere in the world to access your system online!
# =====================================================================

$ErrorActionPreference = "Continue"

$port = if ($env:PORT) { $env:PORT } else { "8000" }

# 1. Ensure PHP is in PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$phpCmd = Get-Command php -ErrorAction SilentlyContinue
if (-not $phpCmd) {
    $wingetPhp = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"
    if (Test-Path $wingetPhp) {
        $env:Path = (Split-Path $wingetPhp) + ";" + $env:Path
        $phpCmd = Get-Command php -ErrorAction SilentlyContinue
    }
}

if (-not $phpCmd) {
    Write-Host "ERROR: PHP is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# 2. Check if local GHRMS PHP server is already running on port
$tcpConn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $tcpConn) {
    Write-Host "[1/2] Starting local GHRMS server on port $port..." -ForegroundColor Cyan
    Start-Process -FilePath "php" -ArgumentList "-S", "0.0.0.0:$port", "router.php" -NoNewWindow
    Start-Sleep -Seconds 1
} else {
    Write-Host "[1/2] Local GHRMS server is active on port $port." -ForegroundColor Green
}

# 3. Locate Tunneling tools (Cloudflare Tunnel or OpenSSH Pinggy)
$cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflaredCmd) {
    $cfPath = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
    if (Test-Path $cfPath) {
        $cloudflaredCmd = $cfPath
    }
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "   GLOBAL HERO REGISTRATION AUTHORITY (GHRMS) // WORLDWIDE PUBLIC GATEWAY" -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "METHOD 1: PERMANENT 24/7 CLOUD HOSTING (InfinityFree):" -ForegroundColor Magenta
Write-Host "   Main Entry:     http://heroregestry.freepage.cc/" -ForegroundColor Green
Write-Host "   Registration:   http://heroregestry.freepage.cc/register" -ForegroundColor Green
Write-Host "   Clearance:      http://heroregestry.freepage.cc/login" -ForegroundColor Green
Write-Host "   Sentinel Field: http://heroregestry.freepage.cc/sentinel" -ForegroundColor Green
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "METHOD 2: INSTANT LIVE TUNNEL (Running directly from your computer):" -ForegroundColor Cyan

if ($cloudflaredCmd) {
    Write-Host "Launching Cloudflare Global Tunnel (Free, Encrypted HTTPS, Works Worldwide)..." -ForegroundColor Yellow
    Write-Host "Cloudflare will generate a public HTTPS address ending in '.trycloudflare.com'." -ForegroundColor Cyan
    Write-Host "Copy that URL and send it to your friends to open on any mobile phone or PC!`n" -ForegroundColor Green
    & $cloudflaredCmd tunnel --url "http://localhost:$port"
} else {
    Write-Host "Launching Native SSH Global Tunnel via Pinggy..." -ForegroundColor Yellow
    ssh -p 443 -R0:localhost:$port -o StrictHostKeyChecking=no a.pinggy.io
}
