import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PaginationControls from "../components/common/PaginationControls";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";

const NotificationsPage = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const paginatedNotifications = notifications.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <div className="card-head">
          <h3>Notifications</h3>
          <div className="header-inline-actions">
            <span className="status-badge status-pending">
              {unreadCount} unread
            </span>
            <button
              type="button"
              className="btn btn-outline"
              onClick={markAllAsRead}
            >
              Mark all as read
            </button>
          </div>
        </div>

        <div className="notification-list">
          {paginatedNotifications.map((item) => (
            <article
              key={item.id}
              className={`notification-item ${item.read ? "read" : ""}`}
            >
              <span className={`notification-dot-item ${item.tone}`} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                {item.requestId ? (
                  <p>
                    <Link
                      to={
                        user?.role === "admin"
                          ? `/admin/requests/${item.requestId}`
                          : `/employee/requests/${item.requestId}`
                      }
                    >
                      Open related request
                    </Link>
                  </p>
                ) : null}
              </div>
              <small>{new Date(item.timestamp).toLocaleString()}</small>
            </article>
          ))}
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </article>
    </section>
  );
};

export default NotificationsPage;
