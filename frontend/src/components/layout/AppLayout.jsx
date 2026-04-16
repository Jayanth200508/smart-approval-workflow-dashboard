import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useRequests } from "../../context/RequestContext";
import { useTheme } from "../../hooks/useTheme";
import RequestFormModal from "../requests/RequestFormModal";
import Breadcrumbs from "./Breadcrumbs";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";

const AppLayout = () => {
  const getViewportState = useMemo(
    () => ({
      isCompact: window.innerWidth <= 1200,
      isMobile: window.innerWidth <= 900,
    }),
    [],
  );
  const { user, logout } = useAuth();
  const { submitRequest } = useRequests();
  const { addNotification, toasts, dismissToast } = useNotifications();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(
    getViewportState.isCompact,
  );
  const [sidebarOpen, setSidebarOpen] = useState(!getViewportState.isMobile);
  const [isMobileViewport, setIsMobileViewport] = useState(
    getViewportState.isMobile,
  );
  const contentRef = useRef(null);
  const scrollMapRef = useRef(new Map());

  useEffect(() => {
    const onResize = () => {
      const nextCompact = window.innerWidth <= 1200;
      const nextMobile = window.innerWidth <= 900;
      setSidebarCompact(nextCompact);
      setIsMobileViewport(nextMobile);
      setSidebarOpen(!nextMobile);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const nextTop = scrollMapRef.current.get(pathname) || 0;
    container.scrollTo({ top: nextTop, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return undefined;

    const storeScroll = () => {
      scrollMapRef.current.set(pathname, container.scrollTop);
    };

    container.addEventListener("scroll", storeScroll, { passive: true });
    return () => {
      storeScroll();
      container.removeEventListener("scroll", storeScroll);
    };
  }, [pathname]);

  useEffect(() => {
    const onOpenModal = () => setIsModalOpen(true);
    window.addEventListener("flowpilot:new-request", onOpenModal);
    return () =>
      window.removeEventListener("flowpilot:new-request", onOpenModal);
  }, []);

  const handleCreateRequest = async (payload) => {
    await submitRequest({
      ...payload,
      requesterId: user.id,
      requesterName: user.fullName,
    });
    addNotification({
      title: "Request submitted",
      message: `"${payload.title}" was submitted and is now pending review.`,
      tone: "success",
    });
    setIsModalOpen(false);
  };

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  return (
    <div className="app-shell">
      <Sidebar
        compact={sidebarCompact}
        isOpen={sidebarOpen}
        isMobileViewport={isMobileViewport}
        onClose={() => setSidebarOpen(false)}
        onToggleCompact={() => setSidebarCompact((prev) => !prev)}
        currentUser={user}
        onLogout={logout}
      />

      <div className="app-main-wrap">
        <TopHeader
          user={user}
          onOpenModal={() => setIsModalOpen(true)}
          onToggleSidebar={handleToggleSidebar}
          onOpenNotifications={() =>
            navigate(
              user?.role === "admin"
                ? "/admin/notifications"
                : "/employee/notifications",
            )
          }
          onToggleTheme={toggleTheme}
          isDark={isDark}
          canCreateRequest={user?.role === "employee"}
        />

        <main className="app-content" ref={contentRef}>
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>

      {user?.role === "employee" ? (
        <RequestFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateRequest}
        />
      ) : null}

      {toasts.length ? (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast-item tone-${toast.tone || "success"}`}>
              <div>
                <strong>{toast.title}</strong>
                <p>{toast.message}</p>
              </div>
              <button
                type="button"
                className="toast-close"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(toast.id)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {sidebarOpen && isMobileViewport ? (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation panel"
        />
      ) : null}
    </div>
  );
};

export default AppLayout;
