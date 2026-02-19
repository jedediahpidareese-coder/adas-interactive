$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolsDir = Join-Path $root ".tools"
$pyPidPath = Join-Path $toolsDir "python-server.pid"
$cfPidPath = Join-Path $toolsDir "cloudflared.pid"

function Stop-FromPidFile {
  param(
    [string]$pidFile,
    [string]$label
  )

  if (-not (Test-Path $pidFile)) {
    Write-Host "$label PID file not found."
    return
  }

  $pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue
  if (-not $pidValue) {
    Remove-Item $pidFile -Force
    Write-Host "$label PID file was empty."
    return
  }

  $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $pidValue -Force
    Write-Host "Stopped $label (PID $pidValue)."
  } else {
    Write-Host "$label process already stopped."
  }

  Remove-Item $pidFile -Force
}

Stop-FromPidFile -pidFile $cfPidPath -label "cloudflared"
Stop-FromPidFile -pidFile $pyPidPath -label "python server"
