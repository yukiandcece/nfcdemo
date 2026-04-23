$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root ".server.pid"

if (-not (Test-Path $pidFile)) {
  Write-Host "No pid file found."
  exit 0
}

$pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue
if (-not $pidValue) {
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host "Pid file was empty."
  exit 0
}

$process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $pidValue -Force
  Write-Host "Server stopped."
} else {
  Write-Host "Process not found, pid file cleaned up."
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
