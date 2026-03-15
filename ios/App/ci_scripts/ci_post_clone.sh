#!/bin/sh
set -e

echo "=== Xcode Cloud: Post Clone Script ==="
echo "Installing Node.js and building web assets for Capacitor..."

export HOMEBREW_NO_INSTALL_CLEANUP=TRUE

brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"

echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "=== Installing npm dependencies ==="
npm ci

echo "=== Building web app ==="
npm run build

echo "=== Syncing Capacitor iOS ==="
npx cap sync ios

echo "=== Post Clone Complete ==="
