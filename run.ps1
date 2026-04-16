$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\frontend"

if (-not (Test-Path ".\node_modules")) {
  npm install
}

Set-Content ".env" "VITE_ENABLE_BACKEND=false`nVITE_API_URL=http://localhost:5000/api"

npm run dev

