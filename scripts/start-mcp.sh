#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd -- "${script_dir}/.." && pwd)"
entrypoint="${plugin_root}/apps/mcp-server/dist/index.js"

if [[ -f "${entrypoint}" ]]; then
  exec node "${entrypoint}"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Caelis MCP requires Node.js and pnpm. Run 'pnpm install && pnpm build' in ${plugin_root}." >&2
  exit 127
fi

if [[ ! -d "${plugin_root}/node_modules" ]]; then
  echo "Caelis dependencies are not installed. Run 'pnpm install' in ${plugin_root}." >&2
  exit 1
fi

exec pnpm --dir "${plugin_root}" --filter @caelis/mcp-server dev
