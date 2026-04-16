#!/usr/bin/env bash
set -euo pipefail

cd frontend

if [ ! -d node_modules ]; then
  npm install
fi

cat > .env << 'EOF'
VITE_ENABLE_BACKEND=false
VITE_API_URL=http://localhost:5000/api
EOF

npm run dev

