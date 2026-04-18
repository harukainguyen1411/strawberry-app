# install-service.ps1
# Installs coder-worker as a Windows service via NSSM.
# Run as Administrator from the repo root:
#   powershell -ExecutionPolicy Bypass -File apps\coder-worker\scripts\windows\install-service.ps1

param(
    [string]$NssmPath = "nssm",
    [string]$NodePath  = (Get-Command node -ErrorAction Stop).Source,
    [string]$RepoRoot  = (git rev-parse --show-toplevel)
)

$ServiceName = "StrawberryCoderWorker"
$WorkerDir   = Join-Path $RepoRoot "apps\coder-worker"
$MainJs      = Join-Path $WorkerDir "dist\index.js"
$EnvFile     = Join-Path $WorkerDir ".env"
$LogDir      = Join-Path $WorkerDir "logs"

# Build first
Write-Host "Building coder-worker..."
Push-Location $WorkerDir
npm install --frozen-lockfile
npm run build
Pop-Location

# Create log dir
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Lock down .env token file: remove inherited ACEs, grant current user only (Pyke M6.2)
if (Test-Path $EnvFile) {
    icacls $EnvFile /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(R,W)" | Out-Null
    Write-Host "Locked down $EnvFile (NTFS ACL: current user only)"
} else {
    Write-Warning ".env not found at $EnvFile - create it before starting the service. Apply NTFS ACL after creating."
}

# Uninstall existing if present
& $NssmPath status $ServiceName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Removing existing service $ServiceName..."
    & $NssmPath stop $ServiceName confirm
    & $NssmPath remove $ServiceName confirm
}

Write-Host "Installing service $ServiceName..."
& $NssmPath install $ServiceName $NodePath $MainJs

& $NssmPath set $ServiceName AppDirectory $WorkerDir
& $NssmPath set $ServiceName AppEnvironmentExtra "NODE_ENV=production" "DOTENV_CONFIG_PATH=$EnvFile"
& $NssmPath set $ServiceName AppStdout (Join-Path $LogDir "stdout.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $LogDir "stderr.log")
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 10485760   # 10MB
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName DisplayName "Strawberry Coder Worker"
& $NssmPath set $ServiceName Description "Polls GitHub for ready issues and invokes Claude Code to open PRs"

Write-Host "Starting service..."
& $NssmPath start $ServiceName

Write-Host ""
Write-Host "Done. Service status:"
& $NssmPath status $ServiceName
Write-Host ""
Write-Host "Logs: $LogDir"
Write-Host "Edit $EnvFile to set GITHUB_TOKEN and other env vars."
