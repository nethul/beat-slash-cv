# Beat Slash – Native CUDA Desktop Launcher
# ==========================================
# Starts both the Python hand tracking server and Electron game app.
# Usage: .\start.ps1 [-NoPython] [-Camera 0] [-Port 9734]

param(
    [switch]$NoPython,
    [int]$Camera = 0,
    [int]$Port = 9734,
    [int]$Width = 640,
    [int]$Height = 480,
    [int]$Fps = 60
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

# Use D:\tmp to avoid C: drive space issues
$env:TEMP = "D:\tmp"
$env:TMP = "D:\tmp"

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "    Beat Slash - CUDA Desktop Launcher    " -ForegroundColor White
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# ─── Launch Electron App (Electron manages Python subprocess automatically) ───

Write-Host "[1/2] Checking dependencies..." -ForegroundColor Yellow

$nodeModules = Join-Path $ProjectRoot "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  Running npm install..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    npm install
    Pop-Location
}

Write-Host "[2/2] Launching Beat Slash Desktop App..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Controls:" -ForegroundColor Cyan
Write-Host "    F11       - Toggle Fullscreen" -ForegroundColor Gray
Write-Host "    Space/Esc - Pause" -ForegroundColor Gray
Write-Host "    R         - Restart" -ForegroundColor Gray
Write-Host "    Ctrl+C    - Exit" -ForegroundColor Gray
Write-Host ""

Push-Location $ProjectRoot
try {
    npm run start
} finally {
    Pop-Location
    # Stop any leftover python server processes
    Get-Process -Name python -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
