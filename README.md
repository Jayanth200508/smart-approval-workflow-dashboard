# Infosys Approval System

Modern multi-page Infosys Approval System with a professional enterprise UI.

## Tech Stack

- Frontend: React + Vite + React Router + Recharts
- Data mode: Mock-first (localStorage), optional backend integration
- Optional backend: Node.js + Express + MongoDB + JWT auth

## Features

- Multi-page app:
  - Login
  - Register
  - Dashboard Overview
  - My Requests
  - Approvals
  - Admin Analytics
- Enterprise layout with sidebar, top header, stats cards, tables, and charts
- Request submission modal
- Status badges: Pending / Approved / Rejected
- Search and status filtering
- Responsive desktop/mobile layout
- Works without backend using built-in mock data and demo accounts

## AI Engine Upgrade (New)

This project now includes an AI-powered approval intelligence layer:

- AI delay prediction with risk level (`Low` / `Medium` / `High`)
- Estimated approval completion datetime
- Missing document and rejection-risk warning before submission
- Auto-generated request summary
- Smart bottleneck detection (slow approvers/departments, stuck requests)
- Smart escalation (reminder + backup approver reassignment + escalation logs)
- Smart route recommendation (faster alternate approvers)
- Modern AI analytics dashboard:
  - average approval time
  - department-wise delays
  - bottleneck heatmap
  - approval success rate
  - request trend chart

### New MongoDB Collections

- `requests` (extended with AI fields)
- `approval_logs`
- `escalations`
- `ai_predictions`

### New APIs

- `POST /api/requests/create`
- `GET /api/requests/prediction/:id`
- `POST /api/escalate/:id`
- `GET /api/analytics/dashboard`

### New Frontend Screens

- Manager: `/employee/ai-analytics`
- Admin: `/admin/ai-analytics`

## One-Command Run

From project root, use any one:

```bash
./run.sh
```

```powershell
.\run.ps1
```

```bat
run.bat
```

Then open `http://localhost:5173`.

## Complete Folder Structure

```text
smart-approval-workflow-dashboard-main/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Request.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── requestRoutes.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   │   └── AnalyticsCharts.jsx
│   │   │   ├── common/
│   │   │   │   ├── StatCard.jsx
│   │   │   │   └── StatusBadge.jsx
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── TopHeader.jsx
│   │   │   ├── requests/
│   │   │   │   ├── RequestFilters.jsx
│   │   │   │   ├── RequestFormModal.jsx
│   │   │   │   └── RequestTable.jsx
│   │   │   └── routing/
│   │   │       └── ProtectedRoute.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── RequestContext.jsx
│   │   ├── data/
│   │   │   └── mockData.js
│   │   ├── pages/
│   │   │   ├── AdminAnalyticsPage.jsx
│   │   │   ├── ApprovalsPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── MyRequestsPage.jsx
│   │   │   ├── NotFoundPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── httpClient.js
│   │   │   ├── mockStore.js
│   │   │   └── requestService.js
│   │   ├── styles/
│   │   │   └── app.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitkeep
└── README.md
```

## Run Frontend Locally (Independent Mock Mode)

1. Open terminal in project root.
2. Move to frontend:
   ```bash
   cd frontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create env file from example:
   ```bash
   cp .env.example .env
   ```
   On Windows PowerShell:
   ```powershell
   Copy-Item .env.example .env
   ```
5. Keep `VITE_ENABLE_BACKEND=false` in `.env`.
6. Start app:
   ```bash
   npm run dev
   ```
7. Open `http://localhost:5173`.

## Demo Credentials (Mock Mode)

- Employee: `employee@smartflow.com` / `password123`
- Manager: `manager@smartflow.com` / `password123`
- Admin: `admin@smartflow.com` / `password123`

## Optional Backend Setup

1. Open a second terminal and move to backend:
   ```bash
   cd backend
   ```
2. Install backend dependencies:
   ```bash
   npm install
   ```
3. Create env file:
   ```bash
   cp .env.example .env
   ```
   On Windows PowerShell:
   ```powershell
   Copy-Item .env.example .env
   ```
4. Ensure MongoDB is running locally or update `MONGODB_URI`.
5. Start backend:
   ```bash
   npm run dev
   ```
6. In `frontend/.env`, set:
   ```env
   VITE_ENABLE_BACKEND=true
   VITE_API_URL=http://localhost:5051/api
   ```

## Backend API Summary

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token)
- `GET /api/requests`
- `POST /api/requests`
- `PATCH /api/requests/:id`
- `GET /api/stats`
