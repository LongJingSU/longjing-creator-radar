$ErrorActionPreference = 'Stop'
$taskDir = Split-Path -Parent $PSScriptRoot
$taskUrl = 'http://127.0.0.1:4318'
$taskReady = $false
try { $taskHealth = Invoke-RestMethod "$taskUrl/api/health" -TimeoutSec 2; $taskReady = $taskHealth.app -eq 'chenxi-creator-radar' } catch { }
if (-not $taskReady) {
    $taskNode = (Get-Command node.exe).Source
    New-Item -ItemType Directory -Force -Path (Join-Path $taskDir 'data') | Out-Null
    Start-Process -FilePath $taskNode -ArgumentList 'server.mjs' -WorkingDirectory $taskDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskDir 'data/server.log') -RedirectStandardError (Join-Path $taskDir 'data/server-error.log')
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 300
        try { $taskHealth = Invoke-RestMethod "$taskUrl/api/health" -TimeoutSec 1; if ($taskHealth.app -eq 'chenxi-creator-radar') { $taskReady = $true; break } } catch { }
    }
}
if (-not $taskReady) { throw '工作台未能启动，请查看 data/server-error.log' }
if ($args -notcontains '--no-open') { Start-Process $taskUrl }
Write-Output $taskUrl
