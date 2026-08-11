# Hermes YouTube Player Plugin

**Native-style floating YouTube player plugin for Hermes Desktop.**

![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black)
![Hermes Desktop](https://img.shields.io/badge/Hermes-Desktop-6f42c1)
![Current](https://img.shields.io/badge/Current-v2.15-22498e)
![License](https://img.shields.io/badge/License-Apache--2.0-blue)

## Overview

Hermes YouTube Player Plugin is a floating desktop pane for searching and playing YouTube inside Hermes Desktop.

Current focus:

- Guard playlist results from stale search writes.

## Install

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\youtube-float-desktop-plugin-v65.zip" "$env:TEMP\youtube-float-desktop-plugin-v65"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\youtube-float-desktop-plugin-v65\install-youtube-float-v2.15.ps1"
```

After installing, fully quit and reopen Hermes Desktop. The pane title should show **YouTube v2.15**.

## Version history

See [`CHANGELOG.md`](CHANGELOG.md).

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
