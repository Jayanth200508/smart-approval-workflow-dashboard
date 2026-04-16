import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useRequests } from "../context/RequestContext";
import PredictionCard from "../components/intelligence/PredictionCard";
import AIRiskCard from "../components/ai/AIRiskCard";
import PredictedDelayCard from "../components/ai/PredictedDelayCard";
import SmartSuggestionsPanel from "../components/ai/SmartSuggestionsPanel";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { buildAutoRequestSummary } from "../services/aiWorkflowService";
import { predictApprovalIntelligence } from "../services/intelligenceService";
import {
  listDepartments,
  listRequestTypes,
  listUsers,
} from "../services/workflowService";

const defaultForm = {
  requestTitle: "",
  requestCategory: "Standard Request",
  department: "",
  approverId: "",
  description: "",
  expectedDate: "",
  priority: "Medium",
  amount: "",
  attachment: null,
};

const fallbackRequestTypes = [
  "Standard Request",
  "Hardware Request",
  "Software Access Request",
  "VPN Access Request",
  "Leave Request",
  "Work From Home Request",
  "IT Support Request",
  "Training Request",
  "Travel Approval",
  "Expense Reimbursement",
];

const priorityKeywords = {
  Critical: ["server down", "critical", "outage", "production down", "security breach"],
  High: ["urgent", "immediately", "asap", "high priority", "blocking"],
};

const suggestPriorityFromText = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();
  if (priorityKeywords.Critical.some((word) => text.includes(word))) return "Critical";
  if (priorityKeywords.High.some((word) => text.includes(word))) return "High";
  return "Medium";
};

const SubmitRequestPage = () => {
  const { user } = useAuth();
  const { submitRequest, requests, error } = useRequests();
  const { addNotification } = useNotifications();
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [isDragActive, setIsDragActive] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState("");
  const fileInputRef = useRef(null);
  const draftStorageKey = `ias_submit_request_draft_${user?.id || "guest"}`;
  const departments = listDepartments();
  const users = listUsers();
  const availableTypes = useMemo(() => {
    const managed = listRequestTypes()
      .map((item) => item.name)
      .filter(Boolean);
    const merged = [...fallbackRequestTypes, ...managed];
    return [...new Set(merged)];
  }, []);
  const userDepartment = user?.department || departments?.[0]?.name || "General";

  const approverOptions = useMemo(
    () =>
      users.filter(
        (item) =>
          item.department === (form.department || userDepartment) &&
          ["manager", "admin", "approver"].includes(
            String(item.role || "").toLowerCase(),
          ) &&
          String(item.status || "Active").toLowerCase() !== "inactive",
      ),
    [users, form.department, userDepartment],
  );

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      department: prev.department || userDepartment,
    }));
  }, [userDepartment]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setForm((prev) => ({
        ...prev,
        ...parsed,
        attachment: null,
      }));
    } catch {
      // ignore invalid drafts
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(
    () => () => {
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    },
    [attachmentPreview],
  );

  const errors = useMemo(() => {
    const next = {
      requestCategory: "",
      requestTitle: "",
      description: "",
      expectedDate: "",
      approverId: "",
    };
    if (!form.requestCategory.trim())
      next.requestCategory = "Please select a request category.";
    if (!form.requestTitle.trim())
      next.requestTitle = "Please enter a request title.";
    if (!form.description.trim())
      next.description = "Please enter a short description.";
    if (!form.expectedDate)
      next.expectedDate = "Please select expected completion date.";
    if (!form.approverId)
      next.approverId = "Please select an approver.";
    return next;
  }, [
    form.requestCategory,
    form.requestTitle,
    form.description,
    form.expectedDate,
    form.approverId,
  ]);

  const completionPercent = useMemo(() => {
    const checks = [
      Boolean(form.requestCategory),
      Boolean(form.requestTitle.trim()),
      Boolean(form.description.trim()),
      Boolean(form.department),
      Boolean(form.priority),
      Boolean(form.expectedDate),
      Boolean(form.approverId),
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [
    form.requestCategory,
    form.requestTitle,
    form.description,
    form.department,
    form.priority,
    form.expectedDate,
    form.approverId,
  ]);

  const predictionInput = useMemo(
    () => ({
      title: form.requestTitle,
      type: form.requestCategory,
      department: form.department || userDepartment,
      amount: Number(form.amount || 0),
      priority: String(form.priority || "Medium").toLowerCase(),
      urgency: form.priority === "Urgent" ? "urgent" : "normal",
      description: form.description,
      expectedDate: form.expectedDate,
      attachments: form.attachment ? [form.attachment.name] : [],
    }),
    [
      form.requestTitle,
      form.requestCategory,
      form.department,
      form.amount,
      form.priority,
      form.description,
      form.expectedDate,
      form.attachment,
      userDepartment,
    ],
  );

  const debouncedPredictionInput = useDebouncedValue(predictionInput, 420);
  const aiSummaryPreview = useMemo(
    () =>
      buildAutoRequestSummary({
        requestTitle: form.requestTitle,
        requestCategory: form.requestCategory,
        description: form.description,
      }),
    [form.requestTitle, form.requestCategory, form.description],
  );

  const highRiskWarning = useMemo(() => {
    const riskScore = Number(prediction?.aiRiskScore || prediction?.riskScore || 0);
    const missing = prediction?.missingDocuments || prediction?.missingFields || [];
    if (riskScore >= 70 && missing.length) {
      return `This request has high chance of rejection because required document is missing: ${missing.join(
        ", ",
      )}.`;
    }
    return "";
  }, [prediction]);

  useEffect(() => {
    if (!user) return;
    const hasEnoughData =
      String(debouncedPredictionInput.title || "").trim().length >= 3 ||
      String(debouncedPredictionInput.description || "").trim().length >= 15;
    if (!hasEnoughData) {
      setPrediction(null);
      setPredictionError("");
      return;
    }

    let cancelled = false;
    const loadPrediction = async () => {
      setPredictionLoading(true);
      setPredictionError("");
      try {
        const result = await predictApprovalIntelligence(
          debouncedPredictionInput,
          requests,
        );
        if (!cancelled) setPrediction(result);
      } catch (error) {
        if (!cancelled) {
          setPredictionError(error.message || "Prediction unavailable");
        }
      } finally {
        if (!cancelled) setPredictionLoading(false);
      }
    };
    loadPrediction();

    return () => {
      cancelled = true;
    };
  }, [debouncedPredictionInput, requests, user]);

  const handleChange = (event) => {
    const { name, value, files, type } = event.target;
    if (type === "file") {
      const file = files?.[0] || null;
      setForm((prev) => ({ ...prev, attachment: file }));
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
      if (file && String(file.type || "").startsWith("image/")) {
        setAttachmentPreview(URL.createObjectURL(file));
      } else {
        setAttachmentPreview("");
      }
      return;
    }
    if (name === "requestTitle" || name === "description") {
      const nextTitle = name === "requestTitle" ? value : form.requestTitle;
      const nextDescription =
        name === "description" ? value : form.description;
      const suggestedPriority = suggestPriorityFromText(nextTitle, nextDescription);
      setForm((prev) => ({
        ...prev,
        [name]: value,
        priority: suggestedPriority,
      }));
      return;
    }
    if (name === "department") {
      setForm((prev) => ({ ...prev, department: value, approverId: "" }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const droppedFile = event.dataTransfer?.files?.[0];
    if (droppedFile) {
      setForm((prev) => ({ ...prev, attachment: droppedFile }));
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const clearAttachment = () => {
    setForm((prev) => ({ ...prev, attachment: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachmentPreview("");
  };

  const saveDraft = () => {
    const { attachment, ...draftPayload } = form;
    localStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));
    setToastType("success");
    setToastMessage("Draft saved successfully.");
  };

  const cancelForm = () => {
    setForm({ ...defaultForm, department: userDepartment });
    setSubmitAttempted(false);
    setSuccessMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachmentPreview("");
    localStorage.removeItem(draftStorageKey);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setSuccessMessage("");
    if (
      errors.requestCategory ||
      errors.requestTitle ||
      errors.description ||
      errors.expectedDate ||
      errors.approverId
    ) {
      setToastType("error");
      setToastMessage("Please complete all required fields.");
      return;
    }
    const duplicateFound = requests.find((item) => {
      if (item.requesterId !== user.id) return false;
      const within7Days =
        Date.now() - new Date(item.submittedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
      if (!within7Days) return false;
      const normalizedCurrent = form.requestTitle.trim().toLowerCase();
      const normalizedExisting = String(item.title || "").trim().toLowerCase();
      return normalizedCurrent && normalizedExisting.includes(normalizedCurrent);
    });
    if (duplicateFound) {
      const proceed = window.confirm(
        "You submitted a similar request recently. Do you still want to continue?",
      );
      if (!proceed) return;
    }
    setSubmitting(true);
    try {
      const finalPriority =
        form.priority === "Urgent" ? "Critical" : form.priority;
      const created = await submitRequest({
        ...form,
        title: form.requestTitle,
        type: form.requestCategory,
        department: form.department || userDepartment,
        priority: finalPriority,
        requesterId: user.id,
        requesterName: user.fullName,
      });
      addNotification({
        title: "Request submitted",
        message: `${form.requestTitle} is now pending approval.`,
        tone: "warning",
        requestId: created?.id || "",
      });
      setForm({
        ...defaultForm,
        requestCategory: form.requestCategory || "Standard Request",
        department: userDepartment,
      });
      setSubmitAttempted(false);
      setSuccessMessage(
        "Request submitted successfully. Your manager will review it shortly.",
      );
      setToastType("success");
      setToastMessage("Request submitted successfully.");
      localStorage.removeItem(draftStorageKey);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview("");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldValid = (key) => !errors[key] && Boolean(form[key]?.toString().trim());

  return (
    <section className="page-stack">
      <article className="surface-card fade-in submit-request-shell modern-submit-shell">
        <div className="submit-head">
          <div>
            <h3>Submit New Request</h3>
            <p className="muted-line">
              Create a request with complete details for faster approval.
            </p>
          </div>
          <div className="submit-progress">
            <span>{completionPercent}% Complete</span>
            <div className="progress-track">
              <i style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
        </div>
        <form className="settings-form submit-request-form" onSubmit={handleSubmit}>
          <section className="request-form-section">
            <h4>Request Information</h4>
            <div className="request-form-grid request-modern-grid">
              <label className="field-with-icon">
                <span>
                  Request Category
                  <em title="Select the request category that best matches your need.">
                    i
                  </em>
                </span>
                <div className="field-control">
                  <i className="field-icon">#</i>
                  <select
                    name="requestCategory"
                    value={form.requestCategory}
                    onChange={handleChange}
                    required
                  >
                    {availableTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                {fieldValid("requestCategory") ? (
                  <small className="field-valid">Looks good</small>
                ) : null}
                {submitAttempted && errors.requestCategory ? (
                  <small className="field-error">{errors.requestCategory}</small>
                ) : null}
              </label>
              <label className="field-with-icon">
                <span>Request Title</span>
                <div className="field-control">
                  <i className="field-icon">T</i>
                  <input
                    name="requestTitle"
                    value={form.requestTitle}
                    onChange={handleChange}
                    placeholder="Example: VPN access for client deployment"
                    required
                  />
                </div>
                {fieldValid("requestTitle") ? (
                  <small className="field-valid">Looks good</small>
                ) : null}
                {submitAttempted && errors.requestTitle ? (
                  <small className="field-error">{errors.requestTitle}</small>
                ) : null}
              </label>
              <label className="request-description-field field-with-icon span-2">
                <span>Request Description</span>
                <div className="field-control textarea-control">
                  <i className="field-icon">?</i>
                  <textarea
                    name="description"
                    rows={7}
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe what you need, business context, and expected outcome."
                    required
                  />
                </div>
                {fieldValid("description") ? (
                  <small className="field-valid">Looks good</small>
                ) : null}
                {submitAttempted && errors.description ? (
                  <small className="field-error">{errors.description}</small>
                ) : null}
              </label>
            </div>
          </section>

          <section className="request-form-section">
            <h4>Request Details</h4>
            <div className="request-form-grid request-modern-grid">
              <label className="field-with-icon">
                <span>Department</span>
                <div className="field-control">
                  <i className="field-icon">D</i>
                  <select
                    name="department"
                    value={form.department || userDepartment}
                    onChange={handleChange}
                  >
                    {departments.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="field-with-icon">
                <span>Priority Level</span>
                <div className="field-control">
                  <i className="field-icon">!</i>
                  <select name="priority" value={form.priority} onChange={handleChange}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </label>
              <label className="field-with-icon">
                <span>Estimated Amount</span>
                <div className="field-control">
                  <i className="field-icon">$</i>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </div>
              </label>
              <label className="field-with-icon">
                <span>Expected Completion Date</span>
                <div className="field-control">
                  <i className="field-icon">@</i>
                  <input
                    type="date"
                    name="expectedDate"
                    value={form.expectedDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                {submitAttempted && errors.expectedDate ? (
                  <small className="field-error">{errors.expectedDate}</small>
                ) : null}
              </label>
              <label className="field-with-icon">
                <span>
                  Approver Selection
                  <em title="Approvers are filtered by selected department.">i</em>
                </span>
                <div className="field-control">
                  <i className="field-icon">A</i>
                  <select
                    name="approverId"
                    value={form.approverId}
                    onChange={handleChange}
                  >
                    <option value="">Select approver</option>
                    {approverOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fullName} ({item.role})
                      </option>
                    ))}
                  </select>
                </div>
                {submitAttempted && errors.approverId ? (
                  <small className="field-error">{errors.approverId}</small>
                ) : null}
              </label>
            </div>
          </section>

          <section className="request-form-section">
            <h4>Attachments & Summary</h4>
            <div className="request-form-grid request-modern-grid">
              <label className="file-upload-field span-2">
                <span>Attachment Upload</span>
                <div
                  className={`file-upload-box ${isDragActive ? "drag-active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={openFilePicker}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openFilePicker();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragLeave={() => setIsDragActive(false)}
                  onDrop={handleDrop}
                >
                  <strong>
                    {form.attachment
                      ? form.attachment.name
                      : "Drag files here or click to upload"}
                  </strong>
                  <small>PDF, DOC, JPG, PNG</small>
                  <span className="upload-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M12 16V7m0 0-3 3m3-3 3 3M5 16.5A3.5 3.5 0 0 0 8.5 20h7a3.5 3.5 0 0 0 3.5-3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                <input ref={fileInputRef} type="file" onChange={handleChange} />
              </label>

              <div className="request-summary-card span-2">
                <h5>Request Summary Preview</h5>
                <ul>
                  <li>
                    <strong>Title:</strong> {form.requestTitle || "Not provided"}
                  </li>
                  <li>
                    <strong>Category:</strong>{" "}
                    {form.requestCategory || "Not selected"}
                  </li>
                  <li>
                    <strong>Department:</strong>{" "}
                    {form.department || userDepartment || "Not selected"}
                  </li>
                  <li>
                    <strong>Priority:</strong> {form.priority || "Not selected"}
                  </li>
                  <li>
                    <strong>Amount:</strong>{" "}
                    {form.amount ? `$${Number(form.amount).toLocaleString()}` : "Not provided"}
                  </li>
                  <li>
                    <strong>Expected Date:</strong>{" "}
                    {form.expectedDate || "Not selected"}
                  </li>
                </ul>
              </div>
            </div>

            {form.attachment ? (
              <div className="file-pill" role="status">
                {form.attachment.name}
              </div>
            ) : null}

            {attachmentPreview ? (
              <img
                className="attachment-preview-image"
                src={attachmentPreview}
                alt="Attachment preview"
              />
            ) : null}

            <div className="submit-action-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={saveDraft}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={cancelForm}
              >
                Cancel
              </button>
              {form.attachment ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={clearAttachment}
                >
                  Remove file
                </button>
              ) : null}
              <button
                type="submit"
                className="btn btn-primary submit-request-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="btn-spinner-wrap">
                    <span className="btn-spinner" />
                    Submitting...
                  </span>
                ) : (
                  "Submit Request"
                )}
              </button>
            </div>
          </section>

          {successMessage ? (
            <div className="submit-success">{successMessage}</div>
          ) : null}
          {error ? (
            <div className="inline-error">
              Unable to submit request right now. Please try again. Details:{" "}
              {error}
            </div>
          ) : null}
        </form>
      </article>

      <PredictionCard
        prediction={prediction}
        loading={predictionLoading}
        error={predictionError}
      />

      <section className="analytics-grid">
        <article className="surface-card">
          <div className="ai-card-head">
            <p className="prediction-eyebrow">Auto Request Summary</p>
            <h4>AI Summary Preview</h4>
          </div>
          <p>{aiSummaryPreview}</p>
          {highRiskWarning ? (
            <p className="inline-error ai-warning-text">{highRiskWarning}</p>
          ) : null}
        </article>
        <AIRiskCard prediction={prediction} />
      </section>

      <section className="analytics-grid">
        <PredictedDelayCard prediction={prediction} />
        <SmartSuggestionsPanel prediction={prediction} />
      </section>

      {toastMessage ? (
        <div className={`form-toast ${toastType === "error" ? "error" : "success"}`}>
          {toastMessage}
        </div>
      ) : null}
    </section>
  );
};

export default SubmitRequestPage;
