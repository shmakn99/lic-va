$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:NODE_USE_SYSTEM_CA = '1'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $licNodePath = Join-Path $env:LOCALAPPDATA 'Programs\nodejs'
  if (Test-Path (Join-Path $licNodePath 'node.exe')) { $env:Path = "$licNodePath;$env:Path" }
}
if (-not (Test-Path 'node_modules')) { & npm.cmd ci; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
& npm.cmd run dev
