#!/usr/bin/env bash

set -euxo pipefail

if [ -d "dist" ]; then
  rm -rf dist
fi

bun run lingui:compile
bun run build:frontend
bun run build:backend

cp -r ./src/server/lib/db/migrations ./dist

# `bun build --target=bun` already adds `#!/usr/bin/env bun` shebang, but keep it
# idempotent in case the bundler config changes.
if ! head -n1 dist/main.js | grep -q '#!'; then
  printf '%s\n' '#!/usr/bin/env bun' | cat - dist/main.js > dist/main.js.tmp
  mv dist/main.js.tmp dist/main.js
fi
chmod +x dist/main.js || true
