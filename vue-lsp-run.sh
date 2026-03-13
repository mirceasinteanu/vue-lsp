#!/bin/sh
set -e
# Entry point for Claude Code — resolves the proxy script relative to this
# file's location so the plugin works from any working directory.
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/vue-lsp-proxy.js" "$@"
