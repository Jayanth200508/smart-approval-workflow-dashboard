const express = require('express');
const Joi = require('joi');
const controller = require('../../controllers/v1/auth.controller');
const validateRequest = require('../../middleware/validateRequest');
const { protect } = require('../../middleware/authMiddleware');

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

router.post('/register', validateRequest(registerSchema), controller.register);
router.post('/login', validateRequest(loginSchema), controller.login);
router.get('/me', protect, controller.me);

module.exports = router;

