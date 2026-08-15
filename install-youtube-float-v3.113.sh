#!/usr/bin/env sh
set -eu

SOURCE_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
SOURCE="$SOURCE_DIR/plugin.js"
MARKER="v3.113"

if [ ! -f "$SOURCE" ]; then
  echo "plugin.js not found next to installer" >&2
  exit 1
fi

add_root() {
  root=$1
  [ -n "$root" ] || return 0
  targets="$targets
$root/desktop-plugins/youtube-float/plugin.js"
  profiles="$root/profiles"
  if [ -d "$profiles" ]; then
    for profile in "$profiles"/*; do
      [ -d "$profile" ] || continue
      targets="$targets
$profile/desktop-plugins/youtube-float/plugin.js"
    done
  fi
}

targets=""
add_root "${HERMES_HOME:-}"
add_root "$HOME/.hermes"
# ponytail: harmless extra macOS path; Desktop builds may use either this or ~/.hermes.
add_root "$HOME/Library/Application Support/hermes"

written=""
printf '%s
' "$targets" | awk 'NF && !seen[$0]++' | while IFS= read -r target; do
  dir=$(dirname -- "$target")
  mkdir -p "$dir"
  cp -f "$SOURCE" "$target"
  if ! grep -q "$MARKER" "$target"; then
    echo "Copy verification failed: $target" >&2
    exit 1
  fi
  written="$written
 - $target"
  printf 'Installed YouTube Float v3.113 to %s
' "$target"
done

printf 'Fully quit Hermes Desktop and reopen it. Pane title should be YouTube v3.113 ★.
'
