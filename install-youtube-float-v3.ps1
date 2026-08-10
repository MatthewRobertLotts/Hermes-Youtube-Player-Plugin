$ErrorActionPreference = 'Stop'
$pluginDir = Join-Path $env:USERPROFILE '.hermes\desktop-plugins\youtube-float'
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
Copy-Item -Force -Path (Join-Path $PSScriptRoot 'plugin.js') -Destination (Join-Path $pluginDir 'plugin.js')
Write-Host "Installed YouTube Float v3 to $pluginDir"
Write-Host "In Hermes Desktop: Command Palette -> Reload desktop plugins, or restart the app."
