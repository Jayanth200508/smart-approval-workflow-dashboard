import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import {
  getProfileImage,
  PROFILE_IMAGE_UPDATED_EVENT,
} from "../../utils/profileImageStorage";

const titleMap = {
  "/employee/dashboard": "Dashboard",
  "/employee/submit-request": "Submit Request",
  "/employee/my-requests": "My Requests",
  "/employee/approvals": "Approvals",
  "/admin/dashboard": "Admin Dashboard",
  "/admin/requests": "All Requests",
  "/admin/approvals": "Approvals",
  "/admin/analytics": "Analytics",
  "/admin/ai-analytics": "AI Analytics",
  "/admin/users": "User Management",
  "/admin/departments": "Department Management",
  "/admin/activity-logs": "System Activity Logs",
  "/admin/announcements": "Announcements",
  "/admin/notifications": "Admin Notifications",
  "/admin/profile": "Admin Profile",
  "/employee/profile": "Profile",
  "/employee/notifications": "Notifications",
  "/employee/help-support": "Help and Support",
  "/employee/ai-analytics": "AI Analytics",
  "/employee/settings": "Settings",
  "/admin/settings": "Settings",
  "/employee/department-requests": "Department Requests",
  "/employee/approved-requests": "Approved Requests",
  "/admin/request-types": "Request Types",
};

const TopHeader = ({
  user,
  onOpenModal,
  onToggleSidebar,
  onOpenNotifications,
  onToggleTheme,
  isDark,
  canCreateRequest,
}) => {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileImage, setProfileImageState] = useState("");
  const title = useMemo(() => {
    if (
      pathname.startsWith("/employee/requests/") ||
      pathname.startsWith("/admin/requests/")
    )
      return "Request Detail";
    return titleMap[pathname] || "Infosys Approval System";
  }, [pathname]);

  useEffect(() => {
    setProfileImageState(getProfileImage(user?.id));
  }, [user?.id]);

  useEffect(() => {
    setMenuOpen(false);
    setNotificationOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onProfileImageUpdate = (event) => {
      if (!user?.id) return;
      if (!event?.detail?.userId || event.detail.userId === user.id) {
        setProfileImageState(getProfileImage(user.id));
      }
    };
    window.addEventListener(PROFILE_IMAGE_UPDATED_EVENT, onProfileImageUpdate);
    return () =>
      window.removeEventListener(
        PROFILE_IMAGE_UPDATED_EVENT,
        onProfileImageUpdate,
      );
  }, [user?.id]);

  return (
    <header className="top-header">
      <div className="top-header-main">
        <button
          type="button"
          className="icon-button sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
        <div className="page-meta">
          <h1>{title}</h1>
          <p>Infosys internal approval workflow management.</p>
        </div>
      </div>

      <div className="top-header-actions">
        <label className="header-search">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            placeholder="Search requests, teams, or tags..."
            aria-label="Search"
            inputMode="search"
          />
        </label>

        {canCreateRequest ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenModal}
          >
            New Request
          </button>
        ) : null}

        {["employee", "manager"].includes(user?.role || "") ? (
          <>
            <button
              type="button"
              className="icon-button"
              onClick={() => setNotificationOpen((prev) => !prev)}
              aria-label="Open notification center"
              aria-expanded={notificationOpen}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M12 3a5 5 0 0 0-5 5v2.2c0 .7-.2 1.4-.6 2l-1.3 2A1 1 0 0 0 6 16h12a1 1 0 0 0 .9-1.5l-1.3-2a3.7 3.7 0 0 1-.6-2V8a5 5 0 0 0-5-5zm0 18a2.5 2.5 0 0 1-2.5-2h5A2.5 2.5 0 0 1 12 21z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {unreadCount > 0 ? (
                <span className="notification-dot">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
            {notificationOpen ? (
              <div
                className="notification-popover"
                role="region"
                aria-label="Notification center"
              >
                <div className="notification-popover-head">
                  <strong>Notifications</strong>
                  <button type="button" onClick={markAllAsRead}>
                    Mark all as read
                  </button>
                </div>
                <div className="notification-popover-list">
                  {notifications.slice(0, 5).map((item) => (
                    <article
                      key={item.id}
                      className={`notification-popover-item ${item.read ? "read" : ""}`}
                    >
                      <span className={`notification-dot-item ${item.tone}`} />
                      <div>
                        <p>{item.title}</p>
                        <small>{item.message}</small>
                        {item.requestId ? (
                          <Link
                            to={
                              user?.role === "admin"
                                ? `/admin/requests/${item.requestId}`
                                : `/employee/requests/${item.requestId}`
                            }
                          >
                            Open request
                          </Link>
                        ) : null}
                      </div>
                      <time>
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-full"
                  onClick={onOpenNotifications}
                >
                  Open Notifications Page
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          className="icon-button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
        >
          {isDark ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M12 4v2m0 12v2m8-8h-2M6 12H4m12.4 5.6-1.4-1.4M9 9 7.6 7.6m8.8 0L15 9M9 15l-1.4 1.4"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="btn btn-outline header-logout-btn"
          onClick={logout}
        >
          Logout
        </button>

        <div className="user-menu-wrap">
          <button
            type="button"
            className="user-trigger"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
          >
            <span className="avatar">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={`${user?.fullName || "User"} profile`}
                  className="avatar-image"
                />
              ) : (
                (user?.fullName || "U").slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="user-trigger-meta">
              <strong>{user?.fullName || "User"}</strong>
              <small>{user?.role || "member"}</small>
            </span>
          </button>

          {menuOpen ? (
            <div className="user-menu">
              <Link
                to={
                  user?.role === "admin"
                    ? "/admin/profile"
                    : "/employee/profile"
                }
              >
                Profile
              </Link>
              <Link
                to={
                  user?.role === "admin"
                    ? "/admin/notifications"
                    : "/employee/notifications"
                }
              >
                Notifications
              </Link>
              <button type="button" onClick={logout}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
