#!/bin/bash
# Double-click in Finder: installs dependencies on the first run and starts the editor.
cd "$(dirname "$0")" || exit 1

# Finder starts a non-login shell, so load nvm / Homebrew paths if they exist.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is required: https://nodejs.org (or: brew install node)"
  read -r -p "Press Enter to close…"
  exit 1
fi

if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "Installing dependencies (first run only)…"
  npm install --no-audit --no-fund || { read -r -p "npm install failed. Press Enter to close…"; exit 1; }
  touch node_modules
fi

echo "Gesture Flow → http://localhost:8001  (Ctrl+C or close this window to stop)"
npm run dev
