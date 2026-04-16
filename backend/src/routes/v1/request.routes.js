const express = require('express');
const Joi = require('joi');
const controller = require('../../controllers/v1/request.controller');
const validateRequest = require('../../middleware/validateRequest');
const { protect } = require('../../middleware/authMiddleware');

const router = express.Router();

const createSchema = Joi.object({
  title: Joi.string().min(3).max(140).required(),
  description: Joi.string().allow('').max(4000).default(''),
  approvalTypeId: Joi.string().required(),
  departmentId: Joi.string().optional(),
  attachments: Joi.array()
    .items(
      Joi.object({
        fileName: Joi.string().required(),
        fileUrl: Joi.string().required(),
        mimeType: Joi.string().allow('').optional(),
        fileSize: Joi.number().min(0).optional(),
      })
    )
    .default([]),
});

const attachmentSchema = Joi.object({
  fileName: Joi.string().required(),
  fileUrl: Joi.string().required(),
  mimeType: Joi.string().allow('').optional(),
  fileSize: Joi.number().min(0).optional(),
});

router.use(protect);
router.post('/', validateRequest(createSchema), controller.createRequest);
router.get('/', controller.getRequests);
router.get('/mine', controller.getMyRequests);
router.get('/:id', controller.getRequestById);
router.post('/:id/attachments', validateRequest(attachmentSchema), controller.addAttachment);

module.exports = router;

