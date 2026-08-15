#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def current_version() -> str:
    return json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']


def changelog_entry(version: str) -> str:
    text = (ROOT / 'CHANGELOG.md').read_text(encoding='utf-8')
    match = re.search(rf'^## {re.escape(version)}\n(?P<body>.*?)(?=^## v\d+\.\d+(?:\.\d+)?\n|\Z)', text, re.M | re.S)
    if not match:
        raise SystemExit(f'CHANGELOG.md has no entry for {version}')
    body = match.group('body').strip()
    if not body:
        raise SystemExit(f'CHANGELOG.md entry for {version} is empty')
    return body


def notes(version: str) -> str:
    body = changelog_entry(version)
    return (
        f'# Hermes YouTube Player {version}\n\n'
        'Stable release for the Hermes YouTube Player Plugin.\n\n'
        f'## Changes\n\n{body}\n\n'
        '## Install\n\n'
        f'Download `youtube-float-desktop-plugin-{version}.zip`, extract it, run the installer for your platform, then fully quit and reopen Hermes Desktop.\n\n'
        '## Verification\n\n'
        '- GitHub Actions passed on `main` before release.\n'
        '- `node scripts/check-release.mjs`\n'
        '- `node --test tests/*.test.mjs`\n'
        '- `python3 scripts/build-release-zip.py --check`\n'
        '- Bash/ShellCheck/PowerShell installer checks.\n'
    )


def main() -> int:
    parser = argparse.ArgumentParser(description='Generate GitHub release notes from CHANGELOG.md.')
    parser.add_argument('version', nargs='?', default=current_version())
    parser.add_argument('--output', help='write notes to this file instead of stdout')
    args = parser.parse_args()
    text = notes(args.version)
    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding='utf-8')
        print(out)
    else:
        print(text, end='')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
