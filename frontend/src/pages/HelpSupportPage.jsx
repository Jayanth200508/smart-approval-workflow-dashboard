import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { addActivityLog } from "../services/workflowService";

const HelpSupportPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ticketId, setTicketId] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    const generatedTicket = `SUP-${Date.now().toString().slice(-6)}`;
    addActivityLog({
      userName: user?.fullName || "Employee",
      role: user?.role || "employee",
      action: "Support ticket submitted",
      requestId: generatedTicket,
      status: subject.trim(),
    });
    addNotification({
      title: "Support ticket created",
      message: `Ticket ${generatedTicket} has been submitted to administrators.`,
      tone: "success",
    });
    setTicketId(generatedTicket);
    setSubject("");
    setMessage("");
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <h3>Help and Support</h3>
        <p className="muted-line">
          Use this page for guidance and to contact admins when you are blocked.
        </p>
        <div className="notification-list">
          <div className="notification-item">
            <div>
              <strong>Usage Guide</strong>
              <p>
                1. Submit requests with complete details. 2. Track status from
                My Requests. 3. Review notifications for updates.
              </p>
            </div>
          </div>
          <div className="notification-item">
            <div>
              <strong>Contact Admin</strong>
              <p>Email: admin@flowpilot.local</p>
            </div>
          </div>
        </div>
      </article>

      <article className="surface-card fade-in">
        <h3>Submit Support Ticket</h3>
        <form className="settings-form" onSubmit={handleSubmit}>
          <label>
            <span>Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Issue Details</span>
            <textarea
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Submit Ticket
          </button>
        </form>
        {ticketId ? (
          <p className="muted-line">Ticket created: {ticketId}</p>
        ) : null}
      </article>
    </section>
  );
};

export default HelpSupportPage;
