@echo off
cd /d "%~dp0frontend"

if not exist node_modules (
  npm install
)

(
  echo VITE_ENABLE_BACKEND=false
  echo VITE_API_URL=http://localhost:5000/api
) > .env

npm run dev

