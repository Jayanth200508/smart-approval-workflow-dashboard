const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateUniqueEmployeeId } = require('../utils/employeeId');

const normalizeRole = (role) => String(role || '').toLowerCase();

const sanitizeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  employeeId: user.employeeId || '',
  role: normalizeRole(user.role),
  department: user.department,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const listUsers = async () => {
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  return users.map(sanitizeUser);
};

const addUser = async ({ name, email, role, department, password }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const exists = await User.exists({ email: normalizedEmail });
  if (exists) {
    const error = new Error('User with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const employeeId = await generateUniqueEmployeeId(User);
  const created = await User.create({
    name,
    email: normalizedEmail,
    role: normalizeRole(role),
    department,
    employeeId,
    password: hashedPassword,
  });
  return sanitizeUser(created);
};

const updateUserDetails = async ({ userId, payload }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (payload.name) user.name = payload.name;
  if (payload.role) user.role = normalizeRole(payload.role);
  if (payload.department) user.department = payload.department;
  await user.save();
  return sanitizeUser(user);
};

const removeUser = async ({ userId }) => {
  const removed = await User.findByIdAndDelete(userId);
  if (!removed) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  return sanitizeUser(removed);
};

module.exports = {
  listUsers,
  addUser,
  updateUserDetails,
  removeUser,
};
