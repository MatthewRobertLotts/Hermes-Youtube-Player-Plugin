# Hermes YouTube Player Plugin

**Native-style floating YouTube player plugin for Hermes Desktop.**

![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black)
![Hermes Desktop](https://img.shields.io/badge/Hermes-Desktop-6f42c1)
![Current](https://img.shields.io/badge/Current-v2.17-22498e)
![License](https://img.shields.io/badge/License-Apache--2.0-blue)

## Overview

Hermes YouTube Player Plugin is a floating desktop pane for searching and playing YouTube inside Hermes Desktop.

Current focus:

- V67 autostart fix.

## Install

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\youtube-float-desktop-plugin-v67.zip" "$env:TEMP\youtube-float-desktop-plugin-v67"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\youtube-float-desktop-plugin-v67\install-youtube-float-v2.17.ps1"
```

After installing, fully quit and reopen Hermes Desktop. The pane title should show **YouTube v2.17**.

## Version history

See [`CHANGELOG.md`](CHANGELOG.md).

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
