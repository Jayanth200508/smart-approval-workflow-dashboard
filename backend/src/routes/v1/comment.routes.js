const express = require('express');
const Joi = require('joi');
const controller = require('../../controllers/v1/comment.controller');
const validateRequest = require('../../middleware/validateRequest');
const { protect } = require('../../middleware/authMiddleware');

const router = express.Router();

const commentSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
  visibility: Joi.string().valid('INTERNAL', 'REQUESTER_VISIBLE').default('REQUESTER_VISIBLE'),
});

router.use(protect);
router.get('/requests/:id/comments', controller.getComments);
router.post('/requests/:id/comments', validateRequest(commentSchema), controller.addComment);

module.exports = router;

