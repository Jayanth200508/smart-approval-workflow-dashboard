const express = require('express');
const Joi = require('joi');
const authController = require('../controllers/auth.controller');
const validateRequest = require('../middleware/validateRequest');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  role: Joi.string().valid('employee').default('employee'),
  department: Joi.string().min(2).max(80).default('General'),
});

const loginSchema = Joi.object({
  // Frontend currently posts this field as `email`, but it can carry
  // email, employee ID, or username-style identifier.
  email: Joi.string().trim().min(2).max(120).required(),
  password: Joi.string().required(),
});

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.get('/me', protect, authController.me);
router.get('/login-activity', protect, authController.loginActivity);

module.exports = router;
