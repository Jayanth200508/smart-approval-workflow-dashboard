const express = require('express');
const Joi = require('joi');
const authController = require('../controllers/auth.controller');
const validateRequest = require('../middleware/validateRequest');
const { protect, requireRole } = require('../middleware/authMiddleware');
const workflowService = require('../services/workflowV1.service');
const { success } = require('../utils/responseHelpers');

const router = express.Router();

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  role: Joi.string().valid('employee').default('employee'),
  department: Joi.string().min(2).max(80).default('General'),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().min(2).max(120).required(),
  password: Joi.string().required(),
});

const actionSchema = Joi.object({
  requestId: Joi.string().required(),
  comment: Joi.string().allow('').max(2000).default(''),
});

const commentSchema = Joi.object({
  requestId: Joi.string().required(),
  message: Joi.string().min(1).max(2000).required(),
  visibility: Joi.string().valid('INTERNAL', 'REQUESTER_VISIBLE').default('REQUESTER_VISIBLE'),
});

router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/register', validateRequest(registerSchema), authController.register);

router.post(
  '/approve',
  protect,
  requireRole(['approver', 'manager', 'admin']),
  validateRequest(actionSchema),
  async (req, res) =>
    success(
      res,
      await workflowService.approveRequest({
        requestId: req.body.requestId,
        actor: req.user,
        comment: req.body.comment,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
    )
);

router.post(
  '/reject',
  protect,
  requireRole(['approver', 'manager', 'admin']),
  validateRequest(actionSchema),
  async (req, res) =>
    success(
      res,
      await workflowService.rejectRequest({
        requestId: req.body.requestId,
        actor: req.user,
        comment: req.body.comment,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
    )
);

router.post(
  '/comments',
  protect,
  validateRequest(commentSchema),
  async (req, res) =>
    success(
      res,
      await workflowService.addComment({
        requestId: req.body.requestId,
        actor: req.user,
        payload: {
          message: req.body.message,
          visibility: req.body.visibility,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }),
      201
    )
);

router.get('/stats', protect, async (req, res) =>
  success(res, await workflowService.getDashboardSummary({ actor: req.user }))
);

module.exports = router;
