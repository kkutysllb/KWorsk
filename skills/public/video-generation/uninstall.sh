#!/bin/sh
# Uninstall script for video-generation
set -e

echo "→ Uninstalling video-generation..."

if [ -f package.json ]; then
    rm -rf node_modules 2>/dev/null || true
    echo "  → Removed node_modules"
fi

echo "  ✓  video-generation uninstalled successfully."
