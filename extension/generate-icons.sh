#!/bin/bash
# Generates extension icons from public/logo.png using macOS sips
# Run from the repo root: bash extension/generate-icons.sh
set -e
for size in 16 32 48 128; do
  sips -z $size $size public/logo.png --out "extension/icons/${size}.png" > /dev/null
  echo "Generated extension/icons/${size}.png"
done
