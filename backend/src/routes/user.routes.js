const express = require('express');
const Joi = require('joi');
const userController = require('../controllers/user.controller');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const createSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('employee', 'manager', 'admin', 'approver', 'auditor').required(),
  department: Joi.string().min(2).max(80).default('General'),
  password: Joi.string().min(6).max(100).required(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  role: Joi.string().valid('employee', 'manager', 'admin', 'approver', 'auditor'),
  department: Joi.string().min(2).max(80),
}).min(1);

router.use(protect, requireRole('admin'));

router.get('/', userController.getUsers);
router.post('/', validateRequest(createSchema), userController.createUser);
router.patch('/:id', validateRequest(updateSchema), userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
