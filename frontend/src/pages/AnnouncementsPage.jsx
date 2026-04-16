import { useEffect, useState } from "react";
import PaginationControls from "../components/common/PaginationControls";
import { useAuth } from "../context/AuthContext";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from "../services/workflowService";

const AnnouncementsPage = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState(listAnnouncements());
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(announcements.length / PAGE_SIZE));
  const paginatedAnnouncements = announcements.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    try {
      createAnnouncement({ title, message }, user);
      setAnnouncements(listAnnouncements());
      setTitle("");
      setMessage("");
    } catch (submitError) {
      setError(submitError.message || "Unable to publish announcement.");
    }
  };

  const handleUpdate = (event) => {
    event.preventDefault();
    setError("");
    try {
      updateAnnouncement(
        { announcementId: editingAnnouncementId, title, message },
        user,
      );
      setAnnouncements(listAnnouncements());
      setTitle("");
      setMessage("");
      setEditingAnnouncementId("");
    } catch (submitError) {
      setError(submitError.message || "Unable to update announcement.");
    }
  };

  const beginEdit = (item) => {
    setEditingAnnouncementId(item.id);
    setTitle(item.title);
    setMessage(item.message);
  };

  const handleDelete = (announcementId) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      deleteAnnouncement(announcementId, user);
      setAnnouncements(listAnnouncements());
      if (editingAnnouncementId === announcementId) {
        setEditingAnnouncementId("");
        setTitle("");
        setMessage("");
      }
    } catch (submitError) {
      setError(submitError.message || "Unable to delete announcement.");
    }
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <h3>Announcements</h3>
        <form
          className="settings-form"
          onSubmit={editingAnnouncementId ? handleUpdate : handleSubmit}
        >
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
          <div className="header-inline-actions">
            <button className="btn btn-primary" type="submit">
              {editingAnnouncementId
                ? "Update Announcement"
                : "Send Announcement"}
            </button>
            {editingAnnouncementId ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setEditingAnnouncementId("");
                  setTitle("");
                  setMessage("");
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        {error ? <div className="inline-error">{error}</div> : null}
      </article>

      <article className="surface-card fade-in">
        <div className="notification-list">
          {paginatedAnnouncements.map((item) => (
            <div key={item.id} className="notification-item">
              <div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
              </div>
              <div className="header-inline-actions">
                <small>{new Date(item.createdAt).toLocaleString()}</small>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => beginEdit(item)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
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

export default AnnouncementsPage;
