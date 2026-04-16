const express = require('express');
const Joi = require('joi');
const intelligenceController = require('../controllers/intelligence.controller');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const predictionSchema = Joi.object({
  title: Joi.string().allow('').max(160).default(''),
  type: Joi.string().allow('').max(100).default(''),
  department: Joi.string().allow('').max(100).default(''),
  amount: Joi.number().min(0).default(0),
  priority: Joi.string().allow('').default('medium'),
  urgency: Joi.string().allow('').default('normal'),
  description: Joi.string().allow('').max(5000).default(''),
  attachments: Joi.array().items(Joi.string()).default([]),
  expectedDate: Joi.string().allow('').default(''),
});

const rerouteSchema = Joi.object({
  reason: Joi.string().allow('').max(500).default(''),
});

const monitorSchema = Joi.object({
  dryRun: Joi.boolean().default(false),
});

const digitalTwinSchema = Joi.object({
  incomingVolumePerDay: Joi.number().min(1).max(500).optional(),
  horizonDays: Joi.number().min(1).max(60).optional(),
  stageMap: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().allow('').optional(),
        label: Joi.string().allow('').optional(),
        avgHours: Joi.number().min(0.5).optional(),
        capacityPerDay: Joi.number().min(1).optional(),
        automationScore: Joi.number().min(0).max(1).optional(),
      })
    )
    .optional(),
});

router.get('/snapshot', protect, requireRole(['manager', 'admin']), intelligenceController.getSnapshot);
router.post(
  '/predict',
  protect,
  requireRole(['employee', 'manager', 'admin']),
  validateRequest(predictionSchema),
  intelligenceController.predictApproval
);
router.post('/simulation', protect, requireRole(['manager', 'admin']), intelligenceController.runSimulation);
router.post(
  '/digital-twin/simulate',
  protect,
  requireRole(['manager', 'admin']),
  validateRequest(digitalTwinSchema),
  intelligenceController.runDigitalTwinSimulation
);
router.get('/bottlenecks', protect, requireRole(['manager', 'admin']), intelligenceController.getBottlenecks);
router.get('/fairness', protect, requireRole(['manager', 'admin']), intelligenceController.getFairnessDiagnostics);
router.post(
  '/reroute/:requestId',
  protect,
  requireRole(['manager', 'admin']),
  validateRequest(rerouteSchema),
  intelligenceController.rerouteRequest
);
router.post(
  '/monitor/run',
  protect,
  requireRole('admin'),
  validateRequest(monitorSchema),
  intelligenceController.runWorkflowMonitor
);
router.get('/process-dna/:department', protect, requireRole(['manager', 'admin']), intelligenceController.getProcessDna);
router.get(
  '/process-dna/:department/pdf',
  protect,
  requireRole(['manager', 'admin']),
  intelligenceController.exportProcessDnaPdf
);

module.exports = router;
