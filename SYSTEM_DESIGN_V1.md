# Smart Approval Workflow Dashboard - Professional V1 Design

## 1. Actors
- Admin: manages users, roles, workflows, and monitoring.
- Approver: reviews assigned requests and approves/rejects with comments.
- Employee: submits requests and tracks full request lifecycle.

## 2. Workflow
1. Employee submits request.
2. System resolves workflow levels by `approvalTypeId` (+ optional department scope).
3. Level-1 approver receives pending approval.
4. Approver acts:
   - Approve -> move to next level or final approved.
   - Reject -> final rejected.
5. System writes status history, notifications, and audit log for each action.

## 3. MongoDB Collections
- `users`: identity, auth profile, role/department references.
- `roles`: master role names + permissions.
- `departments`: organizational units.
- `approvalTypes`: request categories.
- `workflowLevels`: level-wise routing rules.
- `requests`: master request state (`PENDING/APPROVED/REJECTED/CANCELLED`).
- `requestApprovals`: per-level approver decisions.
- `comments`: discussion thread for each request.
- `attachments`: request files.
- `statusHistory`: timeline of request state changes.
- `notifications`: per-user alerts.
- `auditLogs`: immutable action trail.

## 4. REST API (New)
Base: `/api/v1`

- Auth
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- Requests
  - `POST /requests`
  - `GET /requests`
  - `GET /requests/mine`
  - `GET /requests/:id`
  - `POST /requests/:id/attachments`
- Approvals
  - `GET /approvals/pending`
  - `POST /approvals/:id/approve`
  - `POST /approvals/:id/reject`
- Comments
  - `GET /requests/:id/comments`
  - `POST /requests/:id/comments`
- Dashboard
  - `GET /dashboard/summary`
- Setup (admin)
  - `POST /setup/initialize`
  - `GET /setup/master-data`

## 5. Frontend Page Mapping
- Login: auth + token/session setup.
- Dashboard: summary cards and pending approvals widget.
- Submit Request: type, department, title/description, attachments.
- My Requests: list/filter own requests.
- Approval Panel: pending tasks with approve/reject + comments.
- Request Details: core details, timeline, comments, attachments.

## 6. Design Principles
- Keep business logic in services, thin controllers.
- Keep current state in `requests`; historical and decision records in dedicated collections.
- Prefer clear naming and explicit references (`...Id`) for viva clarity.
- Keep complexity controlled while preserving enterprise-ready structure.

