import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import SplashScreen from "./components/common/SplashScreen";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { RequestProvider } from "./context/RequestContext";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import DashboardPage from "./pages/DashboardPage";
import DepartmentManagementPage from "./pages/DepartmentManagementPage";
import DepartmentRequestsPage from "./pages/DepartmentRequestsPage";
import HelpSupportPage from "./pages/HelpSupportPage";
import LoginPage from "./pages/LoginPage";
import ManagerDashboardPage from "./pages/ManagerDashboardPage";
import MyRequestsPage from "./pages/MyRequestsPage";
import NotFoundPage from "./pages/NotFoundPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import RequestDetailPage from "./pages/RequestDetailPage";
import RequestTypesPage from "./pages/RequestTypesPage";
import RegisterPage from "./pages/RegisterPage";
import SubmitRequestPage from "./pages/SubmitRequestPage";
import SystemActivityLogsPage from "./pages/SystemActivityLogsPage";
import UserManagementPage from "./pages/UserManagementPage";
import SettingsPage from "./pages/SettingsPage";

const ApprovalsPage = lazy(() => import("./pages/ApprovalsPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const AIAnalyticsDashboardPage = lazy(
  () => import("./pages/AIAnalyticsDashboardPage"),
);

const RouteSkeleton = () => (
  <section className="page-stack">
    <article className="surface-card">
      <div className="skeleton-grid">
        <div className="skeleton-item" />
        <div className="skeleton-item" />
      </div>
    </article>
  </section>
);

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <AuthProvider>
      <NotificationProvider>
        <RequestProvider>
          <Suspense fallback={<RouteSkeleton />}>
            <Routes>
              <Route path="/login" element={<LoginPage portal="employee" />} />
              <Route
                path="/employee/login"
                element={<LoginPage portal="employee" />}
              />
              <Route
                path="/user/login"
                element={<LoginPage portal="employee" />}
              />
              <Route path="/admin/login" element={<LoginPage portal="admin" />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route
                path="/employee"
                element={
                  <ProtectedRoute allowedRoles={["employee", "manager"]}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={<Navigate to="/employee/dashboard" replace />}
                />
                <Route
                  path="dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["employee", "manager"]}>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="manager-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["manager"]}>
                      <ManagerDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="department-requests"
                  element={
                    <ProtectedRoute allowedRoles={["manager"]}>
                      <DepartmentRequestsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="approved-requests"
                  element={
                    <ProtectedRoute allowedRoles={["manager"]}>
                      <DepartmentRequestsPage onlyApproved />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="submit-request"
                  element={
                    <ProtectedRoute allowedRoles={["employee"]}>
                      <SubmitRequestPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="my-requests" element={<MyRequestsPage />} />
                <Route path="approvals" element={<MyRequestsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="help-support" element={<HelpSupportPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route
                  path="ai-analytics"
                  element={
                    <ProtectedRoute allowedRoles={["manager"]}>
                      <AIAnalyticsDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="requests/:requestId"
                  element={<RequestDetailPage />}
                />
              </Route>

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="requests" element={<ApprovalsPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route
                  path="departments"
                  element={<DepartmentManagementPage />}
                />
                <Route path="request-types" element={<RequestTypesPage />} />
                <Route
                  path="activity-logs"
                  element={<SystemActivityLogsPage />}
                />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="ai-analytics" element={<AIAnalyticsDashboardPage />} />
                <Route path="approvals" element={<ApprovalsPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route
                  path="notifications"
                  element={<AdminNotificationsPage />}
                />
                <Route path="profile" element={<AdminProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route
                  path="requests/:requestId"
                  element={<RequestDetailPage />}
                />
              </Route>

              <Route
                path="/"
                element={<Navigate to="/employee/login" replace />}
              />
              <Route path="/user" element={<Navigate to="/employee" replace />} />
              <Route
                path="/dashboard"
                element={<Navigate to="/employee/dashboard" replace />}
              />
              <Route
                path="/submit-request"
                element={<Navigate to="/employee/submit-request" replace />}
              />
              <Route
                path="/my-requests"
                element={<Navigate to="/employee/my-requests" replace />}
              />
              <Route
                path="/notifications"
                element={<Navigate to="/employee/notifications" replace />}
              />
              <Route
                path="/profile"
                element={<Navigate to="/employee/profile" replace />}
              />
              <Route
                path="/help-support"
                element={<Navigate to="/employee/help-support" replace />}
              />
              <Route
                path="/admin-dashboard"
                element={<Navigate to="/admin/dashboard" replace />}
              />
              <Route
                path="/all-requests"
                element={<Navigate to="/admin/requests" replace />}
              />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </RequestProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
