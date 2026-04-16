const express = require('express');
const Joi = require('joi');
const aiWorkflowController = require('../controllers/aiWorkflow.controller');
const validateRequest = require('../middleware/validateRequest');
const { protect, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

const escalateSchema = Joi.object({
  reason: Joi.string().allow('').max(500).default(''),
});

router.use(protect, requireRole(['manager', 'admin']));
router.post('/:id', validateRequest(escalateSchema), aiWorkflowController.escalate);

module.exports = router;
