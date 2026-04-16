# Infosys Approval System UI Style Guide

## Design System
- Colors are defined in `src/styles/designSystem.js`.
- Global UI tokens and component styles are in `src/styles/app.css`.
- Font family: `Inter`.
- Spacing scale: `4px, 8px, 16px`.

## Core UI Components
- `src/components/ui/Button.jsx`
- `src/components/ui/Card.jsx`
- `src/components/ui/InputField.jsx`
- Domain components:
  - `src/components/common/StatCard.jsx`
  - `src/components/common/StatusBadge.jsx`
  - `src/components/common/ExportActions.jsx`

## Layout System
- App shell: `src/components/layout/AppLayout.jsx`
- Sidebar: `src/components/layout/Sidebar.jsx`
- Header + Notification center: `src/components/layout/TopHeader.jsx`

## New Product Features
- Notification center context: `src/context/NotificationContext.jsx`
- Request detail timeline: `src/pages/RequestDetailPage.jsx`
- Profile page: `src/pages/ProfilePage.jsx`
- Settings page: `src/pages/SettingsPage.jsx`
- Theme persistence (light/dark): `src/hooks/useTheme.js`

## Integration Notes
1. Keep `src/styles/app.css` imported from `src/main.jsx`.
2. Keep providers in this order in `src/App.jsx`: `AuthProvider -> NotificationProvider -> RequestProvider`.
3. Add new routes only inside protected layout unless auth-free.
4. Use `ExportActions` with serializable row data (`rows` prop) for CSV/print export.
5. If backend adds timeline/comments, map fields in `src/services/requestService.js`.
