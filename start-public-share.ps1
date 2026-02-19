$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$toolsDir = Join-Path $root ".tools"
$cloudflaredExe = Join-Path $toolsDir "cloudflared.exe"
$pyPidPath = Join-Path $toolsDir "python-server.pid"
$cfPidPath = Join-Path $toolsDir "cloudflared.pid"
$cfLogPath = Join-Path $toolsDir "cloudflared.log"

if (-not (Test-Path $toolsDir)) {
  New-Item -ItemType Directory -Path $toolsDir | Out-Null
}

if (-not (Test-Path $cloudflaredExe)) {
  Write-Host "Downloading cloudflared..."
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflaredExe
}

function Stop-MatchingProcess {
  param(
    [string]$name,
    [string]$pattern
  )

  $procs = Get-CimInstance Win32_Process -Filter "Name='$name'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $pattern }

  foreach ($proc in $procs) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Stop-MatchingProcess -name "python.exe" -pattern "http\.server 8000"
Stop-MatchingProcess -name "cloudflared.exe" -pattern "tunnel --url http://127\.0\.0\.1:8000"

# Keep only the current run's tunnel URL in the logfile parsing logic.
Set-Content -Path $cfLogPath -Value ""

function Start-Or-ReuseProcess {
  param(
    [string]$pidFile,
    [string]$processName,
    [scriptblock]$startScript
  )

  if (Test-Path $pidFile) {
    $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
      return [int]$existingPid
    }
  }

  $proc = & $startScript
  $proc.Id | Set-Content $pidFile
  return $proc.Id
}

$pythonPid = Start-Or-ReuseProcess -pidFile $pyPidPath -processName "python" -startScript {
  Start-Process -FilePath "python" -ArgumentList "-m http.server 8000 --bind 127.0.0.1" -WorkingDirectory $root -PassThru
}

$cloudflaredPid = Start-Or-ReuseProcess -pidFile $cfPidPath -processName "cloudflared" -startScript {
  Start-Process -FilePath $cloudflaredExe -ArgumentList "tunnel --url http://127.0.0.1:8000 --logfile .tools\cloudflared.log --no-autoupdate" -WorkingDirectory $root -PassThru
}

$url = $null
for ($i = 0; $i -lt 20; $i++) {
  if (Test-Path $cfLogPath) {
    $url = Select-String -Path $cfLogPath -Pattern "https://[-a-z0-9]+\.trycloudflare\.com" -AllMatches |
      ForEach-Object { $_.Matches } |
      ForEach-Object { $_.Value } |
      Select-Object -Last 1
    if ($url) { break }
  }
  Start-Sleep -Milliseconds 500
}

if (-not $url) {
  Write-Error "Tunnel started but public URL was not found in .tools\\cloudflared.log"
  exit 1
}

Write-Host ""
Write-Host "Public URL (use this for QR):"
Write-Host "$url/index.html"
Write-Host ""
Write-Host "Python PID: $pythonPid"
Write-Host "Cloudflared PID: $cloudflaredPid"
