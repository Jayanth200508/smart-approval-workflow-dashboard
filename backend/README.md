# Infosys Approval System Backend (Mongo-Connected + In-Memory Workflow Engine)

Node.js + Express backend for Infosys Approval System.

- MongoDB Atlas connection on startup (via `MONGODB_URI`)
- Current business data store is still in-memory arrays (migration pending)
- JWT auth + role-based authorization
- Multi-stage approval workflow
- Notifications and analytics
- File upload support via Multer
- Admin user management
- CSV/PDF export endpoints
- Proxy approver delegation
- SLA auto-escalation
- High-amount two-step admin approval confirmation
- Timeline hash + audit trail
- Login activity history

## Folder Structure

```text
backend/
  src/
    app.js
    server.js
    config/
      index.js
    routes/
      index.js
      auth.routes.js
      request.routes.js
      notification.routes.js
      analytics.routes.js
      upload.routes.js
    controllers/
      auth.controller.js
      request.controller.js
      notification.controller.js
      analytics.controller.js
      upload.controller.js
    middleware/
      authMiddleware.js
      validateRequest.js
      errorHandler.js
      rateLimiter.js
    services/
      auth.service.js
      request.service.js
      notification.service.js
      analytics.service.js
    utils/
      logger.js
      responseHelpers.js
    data/
      mockStore.js
    uploads/
      .gitkeep
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

PowerShell:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

Base URL: `http://localhost:5000/api`

## Seeded Demo Users

- `employee@flowpilot.com` / `password123`
- `manager@flowpilot.com` / `password123`
- `admin@flowpilot.com` / `password123`

## Core Workflow

`pending -> manager_review -> admin_review -> approved/rejected/withdrawn`

Notes:
- New request starts at `pending`
- Manager approve escalates to `admin_review` (timeline records manager_review + admin_review)
- Admin performs final approve/reject

## Important Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/requests`
- `GET /api/requests/mine`
- `GET /api/requests/:id`
- `PATCH /api/requests/:id/withdraw`
- `PATCH /api/requests/:id/manager-approve`
- `PATCH /api/requests/:id/manager-reject`
- `PATCH /api/requests/:id/admin-approve`
- `PATCH /api/requests/:id/admin-reject`
- `POST /api/requests/:id/comments`
- `GET /api/requests/manager/queue`
- `POST /api/requests/manager/bulk-action`
- `POST /api/requests/:id/admin-approval-confirmation`
- `POST /api/requests/delegations`
- `DELETE /api/requests/delegations/:delegatorId`
- `POST /api/requests/sla/escalate`
- `GET /api/notifications/mine`
- `GET /api/notifications/mine/grouped`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `POST /api/notifications/digest`
- `POST /api/notifications/overdue-check` (admin)
- `POST /api/notifications/pending-reminder`
- `POST /api/notifications/simulate-email`
- `GET /api/analytics` (admin only)
- `GET /api/analytics/manager`
- `GET /api/auth/login-activity`
- `POST /api/uploads/attachment` (multipart form-data)
- `GET /api/users` (admin)
- `POST /api/users` (admin)
- `PATCH /api/users/:id` (admin)
- `DELETE /api/users/:id` (admin)
- `GET /api/exports/requests.csv|pdf` (admin)
- `GET /api/exports/users.csv|pdf` (admin)
- `GET /api/exports/analytics.csv|pdf` (admin)
- `GET /api/exports/approval-log.csv|pdf` (admin)

## Sample curl

### 1) Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"employee@flowpilot.com\",\"password\":\"password123\"}"
```

### 2) Create Request

```bash
curl -X POST http://localhost:5000/api/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d "{\"title\":\"Office Chairs\",\"type\":\"Operations\",\"department\":\"HR\",\"amount\":1200,\"priority\":\"medium\",\"description\":\"New ergonomic chairs\",\"attachments\":[]}"
```

### 3) Manager Approve

```bash
curl -X PATCH http://localhost:5000/api/requests/<REQUEST_ID>/manager-approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -d "{\"comment\":\"Looks good, escalating to admin\"}"
```

### 4) Admin Final Approve

```bash
curl -X PATCH http://localhost:5000/api/requests/<REQUEST_ID>/admin-approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d "{\"comment\":\"Final approval done\"}"
```

### 5) Fetch Notifications

```bash
curl http://localhost:5000/api/notifications/mine \
  -H "Authorization: Bearer <TOKEN>"
```

### 6) Fetch Analytics (admin only)

```bash
curl http://localhost:5000/api/analytics \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 7) Manager Queue

```bash
curl "http://localhost:5000/api/requests/manager/queue?priority=high&urgency=urgent" \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```

### 8) Add Comment to Request

```bash
curl -X POST http://localhost:5000/api/requests/<REQUEST_ID>/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d "{\"comment\":\"Please attach revised quotation\"}"
```

### 9) Export Requests CSV

```bash
curl -L http://localhost:5000/api/exports/requests.csv \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -o flowpilot-request-summary.csv
```

### 10) High Amount Confirmation Token

```bash
curl -X POST http://localhost:5000/api/requests/<REQUEST_ID>/admin-approval-confirmation \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 11) Bulk Manager Action

```bash
curl -X POST http://localhost:5000/api/requests/manager/bulk-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -d "{\"requestIds\":[\"req_abc\",\"req_def\"],\"action\":\"approve\",\"comment\":\"Bulk reviewed\"}"
```

## File Upload Example

```bash
curl -X POST http://localhost:5000/api/uploads/attachment \
  -H "Authorization: Bearer <TOKEN>" \
  -F "attachment=@/path/to/file.pdf"
```

## Future MongoDB Migration (TODO already marked in code)

1. Replace `src/data/mockStore.js` operations with repository/model calls.
2. Add Mongoose models + indexes for users/requests/notifications.
3. Move seeded demo users to migration/seed script.
