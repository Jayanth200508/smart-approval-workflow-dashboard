const express = require('express');
const exportController = require('../controllers/export.controller');
const { protect, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, requireRole('admin'));

router.get('/requests.csv', exportController.exportRequestSummaryCsv);
router.get('/requests.pdf', exportController.exportRequestSummaryPdf);
router.get('/users.csv', exportController.exportUserReportCsv);
router.get('/users.pdf', exportController.exportUserReportPdf);
router.get('/analytics.csv', exportController.exportAnalyticsCsv);
router.get('/analytics.pdf', exportController.exportAnalyticsPdf);
router.get('/approval-log.csv', exportController.exportApprovalLogCsv);
router.get('/approval-log.pdf', exportController.exportApprovalLogPdf);

module.exports = router;

