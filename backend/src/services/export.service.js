const { listRequests, users } = require('../data/mockStore');
const analyticsService = require('./analytics.service');

const quoteCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const head = headers.join(',');
  const body = rows
    .map((row) => headers.map((key) => quoteCsv(row[key])).join(','))
    .join('\n');
  return `${head}\n${body}`;
};

const requestSummaryRows = () =>
  listRequests().map((item) => ({
    id: item.id,
    title: item.title,
    requesterName: item.requesterName,
    department: item.department,
    status: item.status,
    priority: item.priority,
    urgency: item.urgency,
    amount: item.amount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

const userRows = () =>
  users.map((item) => ({
    id: item.id,
    name: item.name,
    email: item.email,
    role: item.role,
    department: item.department,
    createdAt: item.createdAt,
  }));

const analyticsRows = () => {
  const analytics = analyticsService.getAnalytics();
  return [
    {
      totalRequests: analytics.totalRequests,
      approvalPercentage: analytics.approvalPercentage,
      rejectionPercentage: analytics.rejectionPercentage,
      averageTimeToApproveHours: analytics.averageTimeToApproveHours,
      managerAverageReviewHours: analytics.managerAverageReviewHours,
      highestPriorityOpenItems: analytics.highestPriorityOpenItems,
    },
  ];
};

const approvalLogRows = () => {
  const rows = [];
  listRequests().forEach((request) => {
    (request.auditTrail || []).forEach((event) => {
      rows.push({
        requestId: request.id,
        requestTitle: request.title,
        action: event.action,
        actorName: event.actorName,
        actorRole: event.actorRole,
        comment: event.comment,
        timestamp: event.timestamp,
      });
    });
  });
  return rows;
};

const makeSimplePdfBuffer = (title, lines) => {
  // Minimal single-page PDF builder for export without external dependencies.
  const text = [title, '', ...lines].join('\n').replace(/[()]/g, '');
  const stream = `BT /F1 10 Tf 40 780 Td (${text.replace(/\n/g, ') Tj T* (')}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  let pdf = '%PDF-1.3\n';
  const xref = [0];
  objects.forEach((obj) => {
    xref.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${obj}\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  xref.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};

module.exports = {
  toCsv,
  requestSummaryRows,
  userRows,
  analyticsRows,
  approvalLogRows,
  makeSimplePdfBuffer,
};

