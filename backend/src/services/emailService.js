const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');
const logger = require('../utils/logger');

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 400;
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:5173';

const sanitizeHeaderValue = (value = '') => String(value).replace(/[\r\n]/g, ' ').trim();

const isValidEmail = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
});

let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  const smtp = getSmtpConfig();
  if (!smtp.host || !smtp.port || !smtp.auth?.user || !smtp.auth?.pass) return null;
  transporter = nodemailer.createTransport(smtp);
  return transporter;
};

const logEmailEvent = async ({ recipient, subject, status, eventType, requestId = '', errorMessage = '' }) => {
  try {
    await EmailLog.create({
      recipient,
      subject,
      status,
      sentAt: new Date(),
      eventType,
      requestId: requestId ? String(requestId) : '',
      errorMessage,
    });
  } catch (error) {
    logger.error('Failed to persist email log', { error: error.message, recipient, subject, eventType });
  }
};

const renderTemplate = ({ heading, intro, details = [], ctaLabel = 'View Dashboard', ctaUrl = DASHBOARD_URL }) => {
  const detailRows = details
    .map(
      (item) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${item.label}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">${item.value}</td>
        </tr>`
    )
    .join('');

  return `
  <div style="background:#f1f5f9;padding:24px;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;background:#0f172a;color:#ffffff;">
        <div style="font-size:12px;opacity:.85;margin-bottom:6px;">[Company Logo]</div>
        <h1 style="margin:0;font-size:20px;line-height:1.3;">Infosys Approval System</h1>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 10px;color:#0f172a;font-size:18px;">${heading}</h2>
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">${intro}</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          ${detailRows}
        </table>
        <div style="margin-top:18px;">
          <a href="${ctaUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;">
            ${ctaLabel}
          </a>
        </div>
      </div>
      <div style="padding:14px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
        Automated system email from Infosys Approval System.
      </div>
    </div>
  </div>`;
};

const sendEmail = async ({ recipient, subject, html, eventType = 'generic', requestId = '' }) => {
  const safeRecipient = sanitizeHeaderValue(recipient).toLowerCase();
  const safeSubject = sanitizeHeaderValue(subject);
  const safeFromName = sanitizeHeaderValue(process.env.SMTP_FROM_NAME || 'Infosys Approval System');
  const safeFromEmail = sanitizeHeaderValue(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '');

  if (!isValidEmail(safeRecipient) || !safeSubject) {
    await logEmailEvent({
      recipient: safeRecipient || 'invalid',
      subject: safeSubject || 'invalid',
      status: 'failed',
      eventType,
      requestId,
      errorMessage: 'Invalid recipient or subject',
    });
    return { success: false, status: 'failed', error: 'Invalid recipient or subject' };
  }

  const smtpTransporter = getTransporter();
  if (!smtpTransporter || !safeFromEmail) {
    logger.warn('SMTP not configured. Email skipped.', { recipient: safeRecipient, subject: safeSubject, eventType });
    await logEmailEvent({
      recipient: safeRecipient,
      subject: safeSubject,
      status: 'skipped',
      eventType,
      requestId,
      errorMessage: 'SMTP configuration missing',
    });
    return { success: false, status: 'skipped', error: 'SMTP configuration missing' };
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const info = await smtpTransporter.sendMail({
        from: `"${safeFromName}" <${safeFromEmail}>`,
        to: safeRecipient,
        subject: safeSubject,
        html,
      });
      logger.info('Email sent', { recipient: safeRecipient, subject: safeSubject, eventType, messageId: info.messageId });
      await logEmailEvent({
        recipient: safeRecipient,
        subject: safeSubject,
        status: 'sent',
        eventType,
        requestId,
      });
      return { success: true, status: 'sent', messageId: info.messageId };
    } catch (error) {
      logger.error('Email send failed', {
        recipient: safeRecipient,
        subject: safeSubject,
        eventType,
        attempt,
        error: error.message,
      });
      if (attempt === MAX_RETRIES) {
        await logEmailEvent({
          recipient: safeRecipient,
          subject: safeSubject,
          status: 'failed',
          eventType,
          requestId,
          errorMessage: error.message,
        });
        return { success: false, status: 'failed', error: error.message };
      }
      await wait(RETRY_BACKOFF_MS * attempt);
    }
  }

  return { success: false, status: 'failed', error: 'Unexpected email dispatch state' };
};

const sendRequestSubmissionEmail = async ({
  recipient,
  requesterName,
  requestId,
  requestTitle,
  requestDescription,
  department,
  priority,
  submittedAt,
}) =>
  sendEmail({
    recipient,
    subject: 'New Request Submitted for Approval',
    eventType: 'request_submission',
    requestId,
    html: renderTemplate({
      heading: 'New Request Submitted for Approval',
      intro: 'A new approval request has been submitted and requires your review.',
      details: [
        { label: 'Requester', value: requesterName || 'N/A' },
        { label: 'Request ID', value: requestId || 'N/A' },
        { label: 'Title', value: requestTitle || 'N/A' },
        { label: 'Description', value: requestDescription || '-' },
        { label: 'Department', value: department || 'N/A' },
        { label: 'Priority', value: priority || 'N/A' },
        { label: 'Submission Date', value: submittedAt || new Date().toISOString() },
      ],
      ctaLabel: 'Review Request',
    }),
  });

const sendApprovalEmail = async ({
  recipient,
  requestId,
  approverName,
  approvalStage,
  comments,
  nextStep,
}) =>
  sendEmail({
    recipient,
    subject: 'Request Approved',
    eventType: 'request_approved',
    requestId,
    html: renderTemplate({
      heading: 'Request Approved',
      intro: 'An approval action has been completed successfully.',
      details: [
        { label: 'Request ID', value: requestId || 'N/A' },
        { label: 'Approved By', value: approverName || 'N/A' },
        { label: 'Approval Stage', value: approvalStage || 'N/A' },
        { label: 'Comments', value: comments || '-' },
        { label: 'Next Step', value: nextStep || 'N/A' },
      ],
      ctaLabel: 'View Workflow',
    }),
  });

const sendRejectionEmail = async ({ recipient, requestId, rejectorName, reason, suggestion }) =>
  sendEmail({
    recipient,
    subject: 'Request Rejected',
    eventType: 'request_rejected',
    requestId,
    html: renderTemplate({
      heading: 'Request Rejected',
      intro: 'Your request was rejected during the review process.',
      details: [
        { label: 'Request ID', value: requestId || 'N/A' },
        { label: 'Rejected By', value: rejectorName || 'N/A' },
        { label: 'Reason', value: reason || 'No reason provided' },
        { label: 'Suggestion', value: suggestion || 'Please review the feedback and resubmit if needed.' },
      ],
      ctaLabel: 'Review Feedback',
    }),
  });

const sendAdminAnnouncement = async ({ recipient, title, message, adminName }) =>
  sendEmail({
    recipient,
    subject: 'System Announcement',
    eventType: 'admin_announcement',
    html: renderTemplate({
      heading: 'Admin Announcement',
      intro: 'A new announcement has been published by the administration team.',
      details: [
        { label: 'Title', value: title || 'Untitled Announcement' },
        { label: 'Message', value: message || '-' },
        { label: 'Announced By', value: adminName || 'Admin' },
      ],
      ctaLabel: 'Open Dashboard',
    }),
  });

const sendPendingReminder = async ({ recipient, requestId, requesterName, submittedAt, pendingHours }) =>
  sendEmail({
    recipient,
    subject: 'Pending Approval Reminder',
    eventType: 'pending_reminder',
    requestId,
    html: renderTemplate({
      heading: 'Pending Approval Reminder',
      intro: 'A request is still pending and needs your attention.',
      details: [
        { label: 'Request ID', value: requestId || 'N/A' },
        { label: 'Submitted By', value: requesterName || 'N/A' },
        { label: 'Submitted At', value: submittedAt || 'N/A' },
        { label: 'Pending Duration', value: `${pendingHours || 24} hours` },
      ],
      ctaLabel: 'Review Pending Request',
    }),
  });

const sendModificationRequestEmail = async ({ recipient, requestId, reviewerName, comments }) =>
  sendEmail({
    recipient,
    subject: 'Request Needs Additional Information',
    eventType: 'request_modification_needed',
    requestId,
    html: renderTemplate({
      heading: 'Request Needs Additional Information',
      intro: 'An approver requested additional details before proceeding.',
      details: [
        { label: 'Request ID', value: requestId || 'N/A' },
        { label: 'Reviewer', value: reviewerName || 'Approver' },
        { label: 'Comments', value: comments || 'Please provide additional information.' },
      ],
      ctaLabel: 'Update Request',
    }),
  });

module.exports = {
  sendEmail,
  sendRequestSubmissionEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendAdminAnnouncement,
  sendPendingReminder,
  sendModificationRequestEmail,
};
