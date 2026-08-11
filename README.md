# Hermes YouTube Player Plugin

**Native-style floating YouTube player plugin for Hermes Desktop.**

![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black)
![Hermes Desktop](https://img.shields.io/badge/Hermes-Desktop-6f42c1)
![Current](https://img.shields.io/badge/Current-v1.21-22498e)
![License](https://img.shields.io/badge/License-Apache--2.0-blue)

## Overview

Hermes YouTube Player Plugin is a floating desktop pane for searching and playing YouTube inside Hermes Desktop.

Current focus:

- V43 quality tick.

## Install

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\youtube-float-desktop-plugin-v43.zip" "$env:TEMP\youtube-float-desktop-plugin-v43"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\youtube-float-desktop-plugin-v43\install-youtube-float-v1.21.ps1"
```

After installing, fully quit and reopen Hermes Desktop. The pane title should show **YouTube v1.21**.

## Version history

See [`CHANGELOG.md`](CHANGELOG.md).

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
