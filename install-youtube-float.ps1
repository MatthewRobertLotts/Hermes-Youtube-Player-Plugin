$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'plugin.js'
$targets = New-Object System.Collections.Generic.List[string]
function Add-Target([string]$root) {
  if ([string]::IsNullOrWhiteSpace($root)) { return }
  $targets.Add((Join-Path $root 'desktop-plugins\youtube-float\plugin.js'))
  $profiles = Join-Path $root 'profiles'
  if (Test-Path $profiles) { Get-ChildItem -Path $profiles -Directory -ErrorAction SilentlyContinue | ForEach-Object { $targets.Add((Join-Path $_.FullName 'desktop-plugins\youtube-float\plugin.js')) } }
}
Add-Target (Join-Path $env:LOCALAPPDATA 'hermes')
Add-Target (Join-Path $env:USERPROFILE '.hermes')
try { Add-Target ([Environment]::GetEnvironmentVariable('HERMES_HOME', 'User')) } catch {}
try { Add-Target ([Environment]::GetEnvironmentVariable('HERMES_HOME', 'Process')) } catch {}
$written = @()
$targets | Select-Object -Unique | ForEach-Object {
  $dir = Split-Path $_ -Parent
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Copy-Item -Force -Path $source -Destination $_
  $text = Get-Content -Raw -Path $_
  if ($text -notmatch 'v3.90-spread-media-controls') { throw "Copy verification failed: $_" }
  $written += $_
}
Write-Host 'Installed YouTube Float v3.90 to:'
$written | ForEach-Object { Write-Host " - $_" }
Write-Host 'Fully quit Hermes Desktop and reopen it. Pane title should be YouTube v3.90 ★.'
