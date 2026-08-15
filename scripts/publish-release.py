#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = 'MatthewRobertLotts/Hermes-Youtube-Player-Plugin'


def run(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    if proc.returncode:
        raise SystemExit(proc.stderr or proc.stdout or f'failed: {cmd!r}')
    return proc.stdout.strip()


def version() -> str:
    return json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']


def ensure_clean() -> None:
    if run(['git', 'status', '--short']):
        raise SystemExit('working tree is not clean')


def main() -> int:
    v = version()
    parser = argparse.ArgumentParser(description='Build notes/zip and publish the current tag as a GitHub Release.')
    parser.add_argument('--dry-run', action='store_true', help='print the gh command without publishing')
    parser.add_argument('--repo', default=REPO)
    parser.add_argument('--zip', default=str(Path.home() / 'Downloads' / f'youtube-float-desktop-plugin-{v}.zip'))
    args = parser.parse_args()

    if not args.dry_run:
        ensure_clean()
        tag_target = run(['git', 'rev-parse', f'{v}^{{}}'])
        head = run(['git', 'rev-parse', 'HEAD'])
        if tag_target != head:
            raise SystemExit(f'{v} tag does not point at HEAD')
    if shutil.which('gh') is None:
        raise SystemExit('gh is required to publish releases')

    zip_path = Path(args.zip)
    notes_path = Path('/tmp') / f'youtube-float-{v}-release-notes.md'
    run(['python3', 'scripts/build-release-zip.py', '--output', str(zip_path), '--check'])
    run(['python3', 'scripts/changelog-release-notes.py', '--output', str(notes_path)])

    cmd = [
        'gh', 'release', 'create', v, str(zip_path),
        '--repo', args.repo,
        '--title', f'Hermes YouTube Player {v}',
        '--notes-file', str(notes_path),
        '--latest',
    ]
    if args.dry_run:
        print(' '.join(cmd))
        return 0
    print(run(cmd))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
