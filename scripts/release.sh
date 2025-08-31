#!/usr/bin/env bash

set -euxo pipefail

if [ -d "dist/.next" ]; then
  rm -rf dist/.next
fi

pnpm build

cp -r .next/standalone ./dist/

pnpm release-it
