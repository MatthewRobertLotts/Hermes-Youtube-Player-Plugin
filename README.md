# Hermes YouTube Player Plugin

**Native-style floating YouTube player plugin for Hermes Desktop.**

![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black)
![Hermes Desktop](https://img.shields.io/badge/Hermes-Desktop-6f42c1)
![Current](https://img.shields.io/badge/Current-v1.10-22498e)
![License](https://img.shields.io/badge/License-Apache--2.0-blue)

## Overview

Hermes YouTube Player Plugin is a floating desktop pane for searching and playing YouTube inside Hermes Desktop.

Current focus:

- V32 captions dual path.

## Install

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\youtube-float-desktop-plugin-v32.zip" "$env:TEMP\youtube-float-desktop-plugin-v32"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\youtube-float-desktop-plugin-v32\install-youtube-float-v1.10.ps1"
```

After installing, fully quit and reopen Hermes Desktop. The pane title should show **YouTube v1.10**.

## Version history

See [`CHANGELOG.md`](CHANGELOG.md).

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
