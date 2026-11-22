#!/usr/bin/env bash
# Builds the whole GitHub Pages site into _site/.
# Every top-level folder becomes /<folder>/: folders with a package.json are
# built (`npm run build` -> dist/), folders with a plain index.html are copied.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf _site
mkdir -p _site
cp index.html _site/

for dir in */; do
  name="${dir%/}"
  case "$name" in _site | node_modules | scripts) continue ;; esac
  if [ -f "$name/package.json" ]; then
    echo "Building $name"
    (cd "$name" && npm ci && npm run build)
    cp -r "$name/dist" "_site/$name"
  elif [ -f "$name/index.html" ]; then
    cp -r "$name" "_site/$name"
  fi
done

touch _site/.nojekyll
