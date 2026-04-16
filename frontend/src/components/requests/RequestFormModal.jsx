import { useEffect, useMemo, useState } from "react";
import { getDefaultDueAt } from "../../utils/requestInsights";

const defaultForm = {
  title: "",
  type: "Laptop / Hardware Request",
  department: "Software Development",
  amount: "",
  priority: "Medium",
  description: "",
  urgent: false,
  attachment: null,
};

const RequestFormModal = ({ isOpen, onClose, onSubmit }) => {
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  const errors = useMemo(() => {
    const next = { title: "", amount: "" };
    if (form.title.trim().length < 3)
      next.title = "Title should be at least 3 characters.";
    if (Number(form.amount) <= 0)
      next.amount = "Amount should be greater than 0.";
    return next;
  }, [form.title, form.amount]);

  const smartSuggestion = useMemo(() => {
    const amount = Number(form.amount || 0);
    const basePriority = amount >= 20000 ? "High" : amount >= 7500 ? "Medium" : "Low";
    const suggested = form.urgent ? "Critical" : basePriority;
    const dueAt = getDefaultDueAt({
      priority: suggested,
      submittedAt: new Date().toISOString(),
    });
    const decisionWindow = suggested === "Critical" ? "within 24 hours" : suggested === "High" ? "within 48 hours" : "within 3-5 business days";
    return {
      suggested,
      dueAt,
      decisionWindow,
    };
  }, [form.amount, form.urgent]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target;
    if (type === "file") {
      setForm((prev) => ({ ...prev, attachment: files?.[0] || null }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (errors.title || errors.amount) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm(defaultForm);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-modal-title"
    >
      <form className="modal-card" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div>
            <h2 id="request-modal-title">Create New Request</h2>
            <p>Complete the form below to start a tracked approval flow.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            x
          </button>
        </div>

        <div className="modal-grid">
          <label>
            <span>Request Title</span>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
            />
            {errors.title ? (
              <small className="field-error">{errors.title}</small>
            ) : null}
          </label>

          <label>
            <span>Request Type</span>
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="Laptop / Hardware Request">Laptop / Hardware Request</option>
              <option value="Software Installation Request">Software Installation Request</option>
              <option value="VPN Access Request">VPN Access Request</option>
              <option value="Leave Request">Leave Request</option>
              <option value="Work From Home Request">Work From Home Request</option>
              <option value="IT Support Ticket">IT Support Ticket</option>
              <option value="Bug Escalation Request">Bug Escalation Request</option>
              <option value="Production Incident Report">Production Incident Report</option>
              <option value="Training / Certification Request">Training / Certification Request</option>
              <option value="Travel Approval Request">Travel Approval Request</option>
              <option value="Expense Reimbursement Request">Expense Reimbursement Request</option>
              <option value="Department Change Request">Department Change Request</option>
            </select>
          </label>

          <label>
            <span>Department</span>
            <select
              name="department"
              value={form.department}
              onChange={handleChange}
            >
              <option value="Software Development">Software Development</option>
              <option value="Quality Assurance">Quality Assurance</option>
              <option value="DevOps / Cloud Infrastructure">DevOps / Cloud Infrastructure</option>
              <option value="Cybersecurity">Cybersecurity</option>
              <option value="IT Support">IT Support</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Finance">Finance</option>
              <option value="Project Management Office (PMO)">Project Management Office (PMO)</option>
              <option value="Client Services">Client Services</option>
              <option value="Research and Innovation">Research and Innovation</option>
            </select>
          </label>

          <label>
            <span>Amount</span>
            <input
              type="number"
              min="0"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              required
            />
            {errors.amount ? (
              <small className="field-error">{errors.amount}</small>
            ) : null}
          </label>

          <label>
            <span>Priority</span>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              name="urgent"
              checked={form.urgent}
              onChange={handleChange}
            />
            Mark as urgent
          </label>

          <label className="full-span">
            <span>Description</span>
            <textarea
              name="description"
              rows={4}
              maxLength={260}
              value={form.description}
              onChange={handleChange}
              placeholder="Include business context and expected impact."
            />
          </label>

          <label className="full-span">
            <span>Attachment (PDF/Image)</span>
            <input type="file" accept=".pdf,image/*" onChange={handleChange} />
            {form.attachment ? (
              <small>Selected: {form.attachment.name}</small>
            ) : null}
          </label>
        </div>

        <div className="ai-note">
          <strong>AI Insight</strong>
          <p>
            Suggested priority: <b>{smartSuggestion.suggested}</b>. Expected
            decision window: {smartSuggestion.decisionWindow}. Estimated due by{" "}
            {new Date(smartSuggestion.dueAt).toLocaleDateString()}.
          </p>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || Boolean(errors.title || errors.amount)}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RequestFormModal;
