#!/bin/sh
# Uninstall script for podcast-generation
set -e

echo "→ Uninstalling podcast-generation..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  podcast-generation uninstalled successfully."
