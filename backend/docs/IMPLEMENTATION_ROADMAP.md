# Smart Approval Workflow Dashboard - Implementation Roadmap

## Scope
Upgrade the current system with:
- Fine-grained RBAC permissions
- Admin control center features
- Workflow template + step-based approvals
- Stronger analytics and auditability
- UI consistency with role-aware behavior

---

## Current Baseline (From Existing Code)
- Backend routes already available for auth, requests, users, analytics, notifications, exports.
- Role checks currently use `requireRole(...)` with `employee | manager | admin`.
- MongoDB model currently only has `User` model in code (`name, email, password, role, department`).
- Frontend pages exist for dashboard, approvals, analytics, notifications, profile, settings.

---

## Delivery Plan

## Sprint 1 - RBAC Foundation and Audit Logging

### 1.1 Data Model (MongoDB)
Create collections:
- `roles`
  - `_id`
  - `name` (Admin, Manager, Employee, Approver)
  - `permissions` (string[])
  - `isSystemRole` (boolean)
  - `createdAt`, `updatedAt`
- `audit_logs`
  - `_id`
  - `userId`
  - `action`
  - `entityType`
  - `entityId`
  - `ipAddress`
  - `meta` (object)
  - `timestamp`

Update `users`:
- add `roleId` (ref `roles`)
- add `status` (`active|inactive`)
- keep existing `role` string temporarily for backward compatibility until migration ends.

### 1.2 Backend Changes
Files to add:
- `backend/src/models/Role.js`
- `backend/src/models/AuditLog.js`
- `backend/src/services/rbac.service.js`
- `backend/src/middleware/permissionMiddleware.js`
- `backend/src/services/audit.service.js`

Files to update:
- `backend/src/middleware/authMiddleware.js`
  - hydrate user permissions from role
  - attach `req.user.permissions`
- route files under `backend/src/routes/*.routes.js`
  - move from `requireRole` to `requirePermission` where needed
- `backend/src/controllers/*`
  - write audit logs for create/update/delete/approve/reject/security actions

### 1.3 Permission Matrix (Initial)
- `request.create`
- `request.view.own`
- `request.view.all`
- `request.approve.manager`
- `request.approve.admin`
- `request.reject.manager`
- `request.reject.admin`
- `user.read`
- `user.create`
- `user.update`
- `user.delete`
- `role.read`
- `role.update`
- `department.read`
- `department.create`
- `department.update`
- `department.delete`
- `settings.read`
- `settings.update`
- `analytics.read.admin`
- `analytics.read.manager`

---

## Sprint 2 - Admin Control Center

### 2.1 Data Model
Create `departments` collection:
- `_id`
- `name`
- `description`
- `status`
- `createdAt`, `updatedAt`

### 2.2 API Endpoints
Add routes:
- `GET /api/roles`
- `PATCH /api/roles/:id/permissions`
- `GET /api/departments`
- `POST /api/departments`
- `PATCH /api/departments/:id`
- `DELETE /api/departments/:id`
- `PATCH /api/users/:id/status`
- `GET /api/audit-logs`

### 2.3 Backend Files
Add:
- `backend/src/routes/role.routes.js`
- `backend/src/routes/department.routes.js`
- `backend/src/routes/audit.routes.js`
- `backend/src/controllers/role.controller.js`
- `backend/src/controllers/department.controller.js`
- `backend/src/controllers/audit.controller.js`
- `backend/src/services/role.service.js`
- `backend/src/services/department.service.js`

Update:
- `backend/src/routes/index.js` to mount new modules.

### 2.4 Frontend
Add pages:
- `frontend/src/pages/AdminUsersPage.jsx`
- `frontend/src/pages/AdminRolesPage.jsx`
- `frontend/src/pages/AdminDepartmentsPage.jsx`
- `frontend/src/pages/AuditLogsPage.jsx`

Add services:
- `frontend/src/services/adminUserService.js`
- `frontend/src/services/roleService.js`
- `frontend/src/services/departmentService.js`
- `frontend/src/services/auditService.js`

---

## Sprint 3 - Workflow Template Engine

### 3.1 Data Model
Create collections:
- `workflow_templates`
  - `_id`, `name`, `departmentId`, `createdBy`, `isActive`, timestamps
- `workflow_steps`
  - `_id`, `workflowId`, `stepOrder`, `approverRoleId`, `minAmount`, `maxAmount`, timestamps
- `approvals`
  - `_id`, `requestId`, `stepOrder`, `approverId`, `status`, `comments`, `approvedAt`, `createdAt`
- `request_comments`
  - `_id`, `requestId`, `userId`, `commentText`, `createdAt`
- `attachments`
  - `_id`, `requestId`, `uploadedBy`, `fileName`, `fileUrl`, `fileType`, `uploadedAt`

Update `requests`:
- add `workflowTemplateId`
- add `currentStepOrder`
- add `approvalState` (`pending|approved|rejected|escalated`)
- add `dueAt`

### 3.2 API Endpoints
Add:
- `POST /api/workflows`
- `GET /api/workflows`
- `GET /api/workflows/:id`
- `PATCH /api/workflows/:id`
- `POST /api/workflows/:id/steps`
- `PATCH /api/workflows/:id/steps/:stepId`
- `DELETE /api/workflows/:id/steps/:stepId`
- `GET /api/approvals/request/:requestId`
- `PATCH /api/approvals/:id/approve`
- `PATCH /api/approvals/:id/reject`

Extend existing request endpoints:
- `POST /api/requests/:id/comments`
- `POST /api/requests/:id/attachments`

### 3.3 Backend Files
Add:
- `backend/src/models/WorkflowTemplate.js`
- `backend/src/models/WorkflowStep.js`
- `backend/src/models/Approval.js`
- `backend/src/models/RequestComment.js`
- `backend/src/models/Attachment.js`
- `backend/src/routes/workflow.routes.js`
- `backend/src/routes/approval.routes.js`
- `backend/src/controllers/workflow.controller.js`
- `backend/src/controllers/approval.controller.js`
- `backend/src/services/workflow.service.js`
- `backend/src/services/approval.service.js`

Update:
- `backend/src/services/request.service.js`
- `backend/src/controllers/request.controller.js`

---

## Sprint 4 - Analytics and Intelligence

### 4.1 Data Model
Create/extend:
- `intelligence_daily_rollups`
- `request_risk_scores`

If already present conceptually, persist as dedicated Mongo collections with indexes:
- `(date, department)`
- `(riskLevel, score desc)`

### 4.2 API Endpoints
Add/extend:
- `GET /api/analytics/overview`
- `GET /api/analytics/trends?from=&to=&department=`
- `GET /api/analytics/sla`
- `GET /api/analytics/risk`
- `GET /api/analytics/departments`
- `GET /api/analytics/approver-performance`

### 4.3 Frontend
Update:
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/pages/AdminAnalyticsPage.jsx`
- `frontend/src/pages/IntelligenceHubPage.jsx`
- `frontend/src/components/charts/AnalyticsCharts.jsx`

Add filters:
- date range
- department
- role/team

---

## Sprint 5 - UX and Consistency

### 5.1 UI Improvements
- Enforce role-based menu visibility in sidebar/header.
- Add disabled states for unauthorized controls.
- Standardize buttons/inputs/cards/alerts in dark and light mode.
- Improve tables for mobile with stacked cards.

### 5.2 Frontend Files
Update:
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/components/layout/TopHeader.jsx`
- `frontend/src/components/requests/RequestTable.jsx`
- `frontend/src/components/requests/RequestFormModal.jsx`
- `frontend/src/styles/app.css`
- `frontend/src/context/AuthContext.jsx` (permissions in auth state)

---

## Migration Strategy (Safe Rollout)
1. Introduce new models/routes behind feature flags.
2. Keep old `role` string checks active while adding permission checks.
3. Backfill `roleId` for existing users.
4. Switch route guards from role-based to permission-based.
5. Remove deprecated role-only paths after verification.

---

## Acceptance Criteria
- Every protected API requires permission checks.
- Admin can manage users, roles, departments, and view audit logs.
- Requests can follow configurable multi-step workflows.
- Approval actions are traceable in `audit_logs`.
- Dashboard exposes trend, SLA, and risk analytics.
- UI shows only authorized actions and remains readable in dark mode.

---

## Immediate Next Implementation Order
1. RBAC models + permission middleware.
2. Role seeder with default permission bundles.
3. User-role migration (`role` -> `roleId` sync).
4. Admin role/department APIs.
5. Workflow template + step APIs.
