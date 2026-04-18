# install-discord-relay.ps1
# Installs discord-relay as a Windows service via NSSM.
# Run as Administrator from the repo root:
#   powershell -ExecutionPolicy Bypass -File apps\discord-relay\scripts\windows\install-discord-relay.ps1

param(
    [string]$NssmPath = "nssm",
    [string]$NodePath  = (Get-Command node -ErrorAction Stop).Source,
    [string]$RepoRoot  = (git rev-parse --show-toplevel)
)

$ServiceName = "StrawberryDiscordRelay"
$RelayDir    = Join-Path $RepoRoot "apps\discord-relay"
$MainJs      = Join-Path $RelayDir "dist\index.js"
$EnvFile     = Join-Path $RelayDir ".env"
$LogDir      = Join-Path $RelayDir "logs"
$VarDir      = Join-Path $RelayDir "var"

# Build first
Write-Host "Building discord-relay..."
Push-Location $RelayDir
npm install --frozen-lockfile
npm run build
Pop-Location

# Create dirs
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path $VarDir | Out-Null

if (-not (Test-Path $EnvFile)) {
    Write-Error ".env not found at $EnvFile - copy .env.example and fill in values first."
    exit 1
}

# Lock down .env token file: remove inherited ACEs, grant current user only (Pyke M6.2)
icacls $EnvFile /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(R,W)" | Out-Null
Write-Host "Locked down $EnvFile (NTFS ACL: current user only)"

# Uninstall existing if present
& $NssmPath status $ServiceName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Removing existing service $ServiceName..."
    & $NssmPath stop $ServiceName confirm
    & $NssmPath remove $ServiceName confirm
}

Write-Host "Installing service $ServiceName..."
& $NssmPath install $ServiceName $NodePath $MainJs

& $NssmPath set $ServiceName AppDirectory $RelayDir
& $NssmPath set $ServiceName AppEnvironmentExtra "NODE_ENV=production" "DOTENV_CONFIG_PATH=$EnvFile"
& $NssmPath set $ServiceName AppStdout (Join-Path $LogDir "stdout.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $LogDir "stderr.log")
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 10485760   # 10MB
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName DisplayName "Strawberry Discord Relay"
& $NssmPath set $ServiceName Description "Discord triage bot - routes messages to GitHub issues via Gemini"

# Restart on failure (3 attempts, 10s delay)
& $NssmPath set $ServiceName AppExit Default Restart
& $NssmPath set $ServiceName AppRestartDelay 10000

Write-Host "Starting service..."
& $NssmPath start $ServiceName

Write-Host ""
Write-Host "Done. Service status:"
& $NssmPath status $ServiceName
Write-Host ""
Write-Host "Logs: $LogDir"
