import { useEffect, useMemo, useState } from "react";
import PaginationControls from "../components/common/PaginationControls";
import {
  addNotification,
  listAllNotifications,
  listUsers,
} from "../services/workflowService";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";

const AdminNotificationsPage = () => {
  const { user } = useAuth();
  const { requests } = useRequests();
  const [recipient, setRecipient] = useState("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("warning");
  const [error, setError] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [notificationFeed, setNotificationFeed] = useState(
    listAllNotifications(),
  );
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const employees = useMemo(
    () => listUsers().filter((item) => item.role === "employee"),
    [],
  );
  const pendingCount = requests.filter(
    (item) => item.status === "Pending",
  ).length;

  const refreshFeed = () => setNotificationFeed(listAllNotifications());
  const totalPages = Math.max(
    1,
    Math.ceil(notificationFeed.length / PAGE_SIZE),
  );
  const paginatedFeed = notificationFeed.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSend = (event) => {
    event.preventDefault();
    setError("");
    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }
    addNotification({
      userId: recipient,
      title: title.trim(),
      message: message.trim(),
      tone,
    });
    setSentAt(new Date().toLocaleString());
    setTitle("");
    setMessage("");
    refreshFeed();
  };

  const handleSendReminder = () => {
    addNotification({
      userId: "all",
      title: "Pending Request Reminder",
      message: `There are currently ${pendingCount} pending requests waiting for action.`,
      tone: "warning",
    });
    setSentAt(new Date().toLocaleString());
    refreshFeed();
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <div className="card-head">
          <h3>Admin Notifications</h3>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleSendReminder}
          >
            Send Pending Reminder
          </button>
        </div>
        <p className="muted-line">
          Send system alerts, announcements, and reminders to all users or
          specific employees.
        </p>

        <form className="settings-form" onSubmit={handleSend}>
          <label>
            <span>Recipient</span>
            <select
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
            >
              <option value="all">All Users</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName} ({item.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
            >
              <option value="warning">Alert / Reminder</option>
              <option value="success">Success Update</option>
              <option value="error">Critical Alert</option>
            </select>
          </label>
          <label>
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Message</span>
            <textarea
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Send Notification
          </button>
        </form>
        {error ? <div className="inline-error">{error}</div> : null}
        {sentAt ? (
          <p className="muted-line">
            Last sent by {user?.fullName} at {sentAt}
          </p>
        ) : null}
      </article>

      <article className="surface-card fade-in">
        <h3>Notification Activity</h3>
        <div className="table-scroll">
          <table className="request-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Title</th>
                <th>Recipient</th>
                <th>Message</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFeed.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                  <td>{item.title}</td>
                  <td>{item.userId === "all" ? "All Users" : item.userId}</td>
                  <td>{item.message}</td>
                  <td>
                    <span
                      className={`status-badge status-${item.tone === "error" ? "rejected" : item.tone === "success" ? "approved" : "pending"}`}
                    >
                      {item.tone}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default AdminNotificationsPage;
