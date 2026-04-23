$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root ".server.pid"
$portInUse = netstat -ano | Select-String "LISTENING" | Select-String ":$port"

if ($portInUse) {
  Write-Host "Port $port is already in use."
  Write-Host "Open: http://127.0.0.1:$port"
  exit 0
}

if (Test-Path $pidFile) {
  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($existingPid) {
    $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existing) {
      Write-Host "Server is already running: http://127.0.0.1:$port"
      exit 0
    }
  }
}

$child = Start-Process powershell -ArgumentList @(
  "-NoLogo",
  "-NoProfile",
  "-Command",
  "Set-Location '$root'; python -m http.server $port"
) -WindowStyle Hidden -PassThru

Set-Content -Path $pidFile -Value $child.Id -Encoding ascii

Write-Host "Server started:"
Write-Host "  http://127.0.0.1:$port"
Write-Host "  http://localhost:$port"
