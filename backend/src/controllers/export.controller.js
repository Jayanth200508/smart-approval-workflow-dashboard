const exportService = require('../services/export.service');

const sendCsv = (res, filename, rows) => {
  const csv = exportService.toCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
};

const sendPdf = (res, filename, title, rows) => {
  const lines = rows.map((row) => Object.values(row).join(' | ')).slice(0, 60);
  const pdfBuffer = exportService.makeSimplePdfBuffer(title, lines);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(pdfBuffer);
};

const exportRequestSummaryCsv = async (_req, res) =>
  sendCsv(res, 'flowpilot-request-summary.csv', exportService.requestSummaryRows());

const exportRequestSummaryPdf = async (_req, res) =>
  sendPdf(
    res,
    'infosys-approval-system-request-summary.pdf',
    'Infosys Approval System Request Summary',
    exportService.requestSummaryRows(),
  );

const exportUserReportCsv = async (_req, res) =>
  sendCsv(res, 'flowpilot-user-report.csv', exportService.userRows());

const exportUserReportPdf = async (_req, res) =>
  sendPdf(
    res,
    'infosys-approval-system-user-report.pdf',
    'Infosys Approval System User Report',
    exportService.userRows(),
  );

const exportAnalyticsCsv = async (_req, res) =>
  sendCsv(res, 'flowpilot-analytics.csv', exportService.analyticsRows());

const exportAnalyticsPdf = async (_req, res) =>
  sendPdf(
    res,
    'infosys-approval-system-analytics.pdf',
    'Infosys Approval System Analytics',
    exportService.analyticsRows(),
  );

const exportApprovalLogCsv = async (_req, res) =>
  sendCsv(res, 'flowpilot-approval-log.csv', exportService.approvalLogRows());

const exportApprovalLogPdf = async (_req, res) =>
  sendPdf(
    res,
    'infosys-approval-system-approval-log.pdf',
    'Infosys Approval System Approval Log',
    exportService.approvalLogRows(),
  );

module.exports = {
  exportRequestSummaryCsv,
  exportRequestSummaryPdf,
  exportUserReportCsv,
  exportUserReportPdf,
  exportAnalyticsCsv,
  exportAnalyticsPdf,
  exportApprovalLogCsv,
  exportApprovalLogPdf,
};
