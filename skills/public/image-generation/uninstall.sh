#!/bin/sh
# Uninstall script for image-generation
set -e

echo "→ Uninstalling image-generation..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  image-generation uninstalled successfully."
