#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
tsx="$script_dir/node_modules/.bin/tsx"

if [ ! -x "$tsx" ]; then
  printf '%s\n' "Error: dependencies are not installed. Run: npm ci" >&2
  exit 1
fi

exec "$tsx" "$script_dir/src/cli.ts" "$@"
