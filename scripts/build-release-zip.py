#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def version() -> str:
    return json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']


def package_files(v: str) -> list[str]:
    return [
        'plugin.js',
        'manifest.json',
        f'install-youtube-float-{v}.ps1',
        f'install-youtube-float-{v}.sh',
        'README.md',
        'SECURITY.md',
        'RELEASE_CHECKLIST.md',
        'TROUBLESHOOTING.md',
        'LICENSE',
    ]


def build(output: Path) -> Path:
    v = version()
    files = package_files(v)
    missing = [name for name in files if not (ROOT / name).is_file()]
    if missing:
        raise SystemExit('missing package files: ' + ', '.join(missing))
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name in files:
            zf.write(ROOT / name, name)
    return output


def check(path: Path) -> None:
    v = version()
    expected = package_files(v)
    if not path.is_file():
        raise SystemExit(f'missing zip: {path}')
    with zipfile.ZipFile(path) as zf:
        names = sorted(zf.namelist())
    if names != sorted(expected):
        raise SystemExit('zip contents mismatch\nexpected: ' + repr(sorted(expected)) + '\nactual:   ' + repr(names))


def main() -> int:
    v = version()
    parser = argparse.ArgumentParser(description='Build/check the Hermes YouTube Player release zip.')
    parser.add_argument('--output', default=str(Path.home() / 'Downloads' / f'youtube-float-desktop-plugin-{v}.zip'))
    parser.add_argument('--check', action='store_true', help='verify the zip contents after building')
    args = parser.parse_args()
    out = build(Path(args.output))
    if args.check:
        check(out)
    print(out)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
