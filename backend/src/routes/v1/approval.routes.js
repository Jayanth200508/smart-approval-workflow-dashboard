const express = require('express');
const Joi = require('joi');
const controller = require('../../controllers/v1/approval.controller');
const validateRequest = require('../../middleware/validateRequest');
const { protect, requireRole } = require('../../middleware/authMiddleware');

const router = express.Router();

const actionSchema = Joi.object({
  comment: Joi.string().allow('').max(2000).default(''),
});

router.use(protect, requireRole(['approver', 'manager', 'admin']));
router.get('/pending', controller.getPendingApprovals);
router.post('/:id/approve', validateRequest(actionSchema), controller.approveRequest);
router.post('/:id/reject', validateRequest(actionSchema), controller.rejectRequest);

module.exports = router;

