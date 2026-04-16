const express = require('express');
const Joi = require('joi');
const requestController = require('../controllers/request.controller');
const aiWorkflowController = require('../controllers/aiWorkflow.controller');
const validateRequest = require('../middleware/validateRequest');
const { protect, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

const createRequestSchema = Joi.object({
  title: Joi.string().min(3).max(140).required(),
  type: Joi.string().min(2).max(80).required(),
  department: Joi.string().min(2).max(80).required(),
  amount: Joi.number().min(0).required(),
  priority: Joi.string().valid('low', 'medium', 'high').required(),
  urgency: Joi.string().valid('normal', 'urgent').default('normal'),
  description: Joi.string().allow('').max(2000).default(''),
  attachments: Joi.array().items(Joi.string()).default([]),
});

const aiCreateSchema = Joi.object({
  title: Joi.string().min(3).max(160).required(),
  description: Joi.string().allow('').max(5000).default(''),
  department: Joi.string().min(2).max(80).required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical', 'urgent').default('medium'),
  type: Joi.string().allow('').max(80).default('General'),
  amount: Joi.number().min(0).default(0),
  attachments: Joi.array().items(Joi.string()).default([]),
  urgency: Joi.string().valid('normal', 'urgent').default('normal'),
});

const actionSchema = Joi.object({
  comment: Joi.string().allow('').max(500).default(''),
  confirmationToken: Joi.string().allow('').optional(),
});

const bulkActionSchema = Joi.object({
  requestIds: Joi.array().items(Joi.string().required()).min(1).required(),
  action: Joi.string().valid('approve', 'reject').required(),
  comment: Joi.string().allow('').max(500).default(''),
});

const delegationSchema = Joi.object({
  delegatorId: Joi.string().required(),
  delegateId: Joi.string().required(),
  activeUntil: Joi.date().iso().required(),
});

router.use(protect);

router.post('/create', validateRequest(aiCreateSchema), aiWorkflowController.createRequest);
router.get('/prediction/:id', aiWorkflowController.getPrediction);
router.post('/', validateRequest(createRequestSchema), requestController.createRequest);
router.get('/', requestController.getRequestsByRole);
router.get('/mine', requestController.getMyRequests);
router.get('/manager/queue', requireRole(['manager', 'admin']), requestController.getManagerQueue);
router.get('/:id', requestController.getRequestById);
router.patch('/:id/withdraw', validateRequest(actionSchema), requestController.withdrawRequest);
router.post('/:id/comments', validateRequest(actionSchema), requestController.addComment);

router.patch(
  '/:id/manager-approve',
  requireRole(['manager', 'admin']),
  validateRequest(actionSchema),
  requestController.managerApprove
);
router.patch(
  '/:id/manager-reject',
  requireRole(['manager', 'admin']),
  validateRequest(actionSchema),
  requestController.managerReject
);
router.post(
  '/manager/bulk-action',
  requireRole(['manager', 'admin']),
  validateRequest(bulkActionSchema),
  requestController.managerBulkAction
);

router.post(
  '/:id/admin-approval-confirmation',
  requireRole('admin'),
  requestController.createHighAmountApprovalConfirmation
);
router.patch('/:id/admin-approve', requireRole('admin'), validateRequest(actionSchema), requestController.adminApprove);
router.patch('/:id/admin-reject', requireRole('admin'), validateRequest(actionSchema), requestController.adminReject);

router.post(
  '/delegations',
  requireRole(['manager', 'admin']),
  validateRequest(delegationSchema),
  requestController.setProxyApprover
);
router.delete('/delegations/:delegatorId', requireRole(['manager', 'admin']), requestController.clearProxyApprover);
router.post('/sla/escalate', requireRole('admin'), requestController.runSlaEscalation);

module.exports = router;
