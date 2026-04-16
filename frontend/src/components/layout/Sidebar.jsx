import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import logo from "../../assets/images/flowpilot-logo.svg";
import {
  getProfileImage,
  PROFILE_IMAGE_UPDATED_EVENT,
} from "../../utils/profileImageStorage";

const adminSections = [
  {
    title: "Main",
    items: [
      { to: "/admin/dashboard", label: "Dashboard" },
      { to: "/admin/requests", label: "Requests" },
      { to: "/admin/approvals", label: "Approvals" },
      { to: "/admin/ai-analytics", label: "AI Analytics" },
    ],
  },
  {
    title: "Management",
    items: [
      { to: "/admin/users", label: "Users" },
      { to: "/admin/departments", label: "Departments" },
      { to: "/admin/request-types", label: "Request Types" },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/admin/activity-logs", label: "Activity Logs" },
      { to: "/admin/notifications", label: "Notifications" },
    ],
  },
  {
    title: "Profile",
    items: [
      { to: "/admin/profile", label: "Profile" },
      { to: "/admin/settings", label: "Settings" },
    ],
  },
];

const managerSections = [
  {
    title: "Main",
    items: [
      { to: "/employee/dashboard", label: "Dashboard" },
      { to: "/employee/department-requests", label: "Requests" },
      { to: "/employee/approved-requests", label: "Approvals" },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/employee/notifications", label: "Notifications" },
      { to: "/employee/ai-analytics", label: "AI Analytics" },
    ],
  },
  {
    title: "Profile",
    items: [
      { to: "/employee/profile", label: "Profile" },
      { to: "/employee/settings", label: "Settings" },
    ],
  },
];

const employeeSections = [
  {
    title: "Main",
    items: [
      { to: "/employee/dashboard", label: "Dashboard" },
      { to: "/employee/my-requests", label: "Requests" },
      { to: "/employee/approvals", label: "Approvals" },
    ],
  },
  {
    title: "System",
    items: [{ to: "/employee/notifications", label: "Notifications" }],
  },
  {
    title: "Profile",
    items: [
      { to: "/employee/profile", label: "Profile" },
      { to: "/employee/settings", label: "Settings" },
    ],
  },
];

const iconPaths = {
  "/admin/dashboard":
    "M4 5h7v6H4zm0 8h7v6H4zm9-8h7v3h-7zm0 5h7v9h-7z",
  "/admin/requests":
    "M6 4h8l4 4v12H6zM14 4v4h4M9 12h6M9 15h6",
  "/admin/approvals": "m5 13 4 4L19 7M4 12a8 8 0 1 1 16 0 8 8 0 0 1-16 0z",
  "/admin/ai-analytics":
    "M4 18h16M6 15V9m6 6V6m6 9V11M4 5h16v14H4z",
  "/admin/users":
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0",
  "/admin/departments": "M4 5h16v14H4zM4 10h16M10 5v14",
  "/admin/request-types": "M4 7h16M4 12h16M4 17h10",
  "/admin/activity-logs": "M6 3v18M18 3v18M6 12h12",
  "/admin/notifications":
    "M12 3a5 5 0 0 0-5 5v2.2c0 .7-.2 1.4-.6 2l-1.3 2A1 1 0 0 0 6 16h12a1 1 0 0 0 .9-1.5l-1.3-2a3.7 3.7 0 0 1-.6-2V8a5 5 0 0 0-5-5zm0 18a2.5 2.5 0 0 1-2.5-2h5A2.5 2.5 0 0 1 12 21z",
  "/admin/profile":
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0",
  "/admin/settings":
    "M10.3 3.3a2 2 0 0 1 3.4 0l.5.9a2 2 0 0 0 1.4 1l1 .2a2 2 0 0 1 1.7 1.7l.2 1a2 2 0 0 0 1 1.4l.9.5a2 2 0 0 1 0 3.4l-.9.5a2 2 0 0 0-1 1.4l-.2 1a2 2 0 0 1-1.7 1.7l-1 .2a2 2 0 0 0-1.4 1l-.5.9a2 2 0 0 1-3.4 0l-.5-.9a2 2 0 0 0-1.4-1l-1-.2a2 2 0 0 1-1.7-1.7l-.2-1a2 2 0 0 0-1-1.4l-.9-.5a2 2 0 0 1 0-3.4l.9-.5a2 2 0 0 0 1-1.4l.2-1A2 2 0 0 1 6.7 7l1-.2a2 2 0 0 0 1.4-1l.5-.9zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "/employee/dashboard":
    "M4 5h7v6H4zm0 8h7v6H4zm9-8h7v3h-7zm0 5h7v9h-7z",
  "/employee/my-requests":
    "M6 4h8l4 4v12H6zM14 4v4h4M9 12h6M9 15h6",
  "/employee/approvals":
    "M6 4h8l4 4v12H6zM14 4v4h4M9 12h6M9 15h6",
  "/employee/department-requests":
    "M6 4h8l4 4v12H6zM14 4v4h4M9 12h6M9 15h6",
  "/employee/approved-requests": "m5 13 4 4L19 7M4 12a8 8 0 1 1 16 0 8 8 0 0 1-16 0z",
  "/employee/notifications":
    "M12 3a5 5 0 0 0-5 5v2.2c0 .7-.2 1.4-.6 2l-1.3 2A1 1 0 0 0 6 16h12a1 1 0 0 0 .9-1.5l-1.3-2a3.7 3.7 0 0 1-.6-2V8a5 5 0 0 0-5-5zm0 18a2.5 2.5 0 0 1-2.5-2h5A2.5 2.5 0 0 1 12 21z",
  "/employee/ai-analytics":
    "M4 18h16M6 15V9m6 6V6m6 9V11M4 5h16v14H4z",
  "/employee/profile":
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0",
  "/employee/settings":
    "M10.3 3.3a2 2 0 0 1 3.4 0l.5.9a2 2 0 0 0 1.4 1l1 .2a2 2 0 0 1 1.7 1.7l.2 1a2 2 0 0 0 1 1.4l.9.5a2 2 0 0 1 0 3.4l-.9.5a2 2 0 0 0-1 1.4l-.2 1a2 2 0 0 1-1.7 1.7l-1 .2a2 2 0 0 0-1.4 1l-.5.9a2 2 0 0 1-3.4 0l-.5-.9a2 2 0 0 0-1.4-1l-1-.2a2 2 0 0 1-1.7-1.7l-.2-1a2 2 0 0 0-1-1.4l-.9-.5a2 2 0 0 1 0-3.4l.9-.5a2 2 0 0 0 1-1.4l.2-1A2 2 0 0 1 6.7 7l1-.2a2 2 0 0 0 1.4-1l.5-.9zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};

const Sidebar = ({
  compact,
  isOpen,
  isMobileViewport,
  onClose,
  onToggleCompact,
  currentUser,
  onLogout,
}) => {
  const sections = useMemo(() => {
    if (currentUser?.role === "admin") return adminSections;
    if (currentUser?.role === "manager") return managerSections;
    return employeeSections;
  }, [currentUser?.role]);
  const profileRoute =
    currentUser?.role === "admin" ? "/admin/profile" : "/employee/profile";

  const [profileImage, setProfileImageState] = useState("");

  useEffect(() => {
    setProfileImageState(getProfileImage(currentUser?.id));
  }, [currentUser?.id]);

  useEffect(() => {
    const onProfileImageUpdate = (event) => {
      if (!currentUser?.id) return;
      if (!event?.detail?.userId || event.detail.userId === currentUser.id) {
        setProfileImageState(getProfileImage(currentUser.id));
      }
    };
    window.addEventListener(PROFILE_IMAGE_UPDATED_EVENT, onProfileImageUpdate);
    return () =>
      window.removeEventListener(
        PROFILE_IMAGE_UPDATED_EVENT,
        onProfileImageUpdate,
      );
  }, [currentUser?.id]);

  return (
    <aside
      className={`app-sidebar ${compact ? "compact" : ""} ${isOpen ? "open" : ""}`}
    >
      <div className="sidebar-brand">
        <img src={logo} alt="Infosys logo" className="sidebar-logo" />
        <div className="sidebar-brand-text">
          <strong>IAS</strong>
          <span>Infosys Approval System</span>
        </div>
        <button
          type="button"
          className="sidebar-icon-btn sidebar-compact-btn"
          onClick={onToggleCompact}
          aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
          title={compact ? "Expand navigation" : "Collapse navigation"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {compact ? (
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
        <button
          type="button"
          className="sidebar-icon-btn sidebar-close-btn"
          onClick={onClose}
          aria-label="Close sidebar"
          title="Close navigation"
        >
          x
        </button>
      </div>

      <nav className="sidebar-nav grouped" aria-label="Primary">
        {sections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <p className="sidebar-section-title">{section.title}</p>
            <div className="sidebar-section-links">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "active" : ""}`
                  }
                  title={compact ? item.label : undefined}
                >
                  <span className="sidebar-link-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d={iconPaths[item.to]}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="sidebar-link-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={`sidebar-user ${compact ? "compact" : ""}`}>
        <div className="sidebar-user-main">
          <span className="avatar avatar-lg">
            {profileImage ? (
              <img
                src={profileImage}
                alt={`${currentUser?.fullName || "User"} profile`}
                className="avatar-image"
              />
            ) : (
              (currentUser?.fullName || "U").slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="sidebar-user-copy">
            <p>{currentUser?.fullName || "User"}</p>
            <span>{currentUser?.role || "employee"}</span>
          </div>
        </div>
        <div className="sidebar-user-actions">
          <NavLink
            className="btn btn-outline btn-sm btn-full"
            to={profileRoute}
            onClick={() => {
              if (isMobileViewport) onClose?.();
            }}
          >
            Profile
          </NavLink>
          <button
            className="btn btn-outline btn-sm btn-full"
            type="button"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
