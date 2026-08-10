$ErrorActionPreference = 'Stop'
$pluginDir = Join-Path $env:USERPROFILE '.hermes\desktop-plugins\youtube-float'
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
Copy-Item -Force -Path (Join-Path $PSScriptRoot 'plugin.js') -Destination (Join-Path $pluginDir 'plugin.js')
Write-Host "Installed YouTube Float v4 to $pluginDir"
Write-Host "IMPORTANT: restart Hermes Desktop after installing. This version relies on Electron's YouTube referer hook at app startup."
