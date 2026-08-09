#!/bin/sh
# Uninstall script for music-generation
set -e

echo "→ Uninstalling music-generation..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  music-generation uninstalled successfully."
