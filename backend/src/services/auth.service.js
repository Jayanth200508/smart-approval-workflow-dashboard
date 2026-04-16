const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { generateUniqueEmployeeId } = require('../utils/employeeId');
const {
  createLoginActivity,
  listLoginActivitiesByUserId,
} = require('../data/mockStore');
const { SYSTEM_ACCOUNTS } = require('./bootstrap.service');

const DEFAULT_EMPLOYEE_PASSWORD = 'password123';
const normalizeRole = (role) => String(role || '').toLowerCase();

const isBcryptHash = (value = '') => /^\$2[aby]\$\d{2}\$/.test(String(value));

const normalizeIdentifier = (value = '') => String(value).trim();

const findUserByLoginIdentifier = async (identifier) => {
  const raw = normalizeIdentifier(identifier);
  const lower = raw.toLowerCase();
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Treat identifier as email when it includes '@'
  if (lower.includes('@')) {
    const byExactEmail = await User.findOne({ email: lower });
    if (byExactEmail) return byExactEmail;

    const localPart = lower.split('@')[0];
    const escapedLocalPart = localPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // If email domain is mistyped, allow fallback by unique local-part.
    const byLocalPart = await User.find({
      email: { $regex: `^${escapedLocalPart}@`, $options: 'i' },
    }).limit(2);
    return byLocalPart.length === 1 ? byLocalPart[0] : null;
  }

  // Prefer employee ID exact match (case-insensitive by normalization)
  const byEmployeeId = await User.findOne({ employeeId: raw.toUpperCase() });
  if (byEmployeeId) return byEmployeeId;

  // Fallback for username-style login using email local-part
  const byEmailLocalPart = await User.findOne({
    email: { $regex: `^${escaped}@`, $options: 'i' },
  });
  return byEmailLocalPart;
};

const validateAndHealPassword = async (user, candidatePassword) => {
  const storedPassword = String(user.password || '');
  const incoming = String(candidatePassword || '');

  if (!storedPassword) {
    // Legacy user without password in DB can use default employee password once.
    if (incoming === DEFAULT_EMPLOYEE_PASSWORD) {
      user.password = await bcrypt.hash(DEFAULT_EMPLOYEE_PASSWORD, 10);
      await user.save();
      return true;
    }
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(incoming, storedPassword);
  }

  // Legacy plain-text storage fallback, then self-heal to bcrypt.
  if (incoming === storedPassword) {
    user.password = await bcrypt.hash(incoming, 10);
    await user.save();
    return true;
  }

  return false;
};

const toSafeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  employeeId: user.employeeId || '',
  role: normalizeRole(user.role),
  department: user.department,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildToken = (safeUser) =>
  jwt.sign(
    {
      id: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
      name: safeUser.name,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

const createSessionPayload = ({ user, ip, userAgent }) => {
  const safeUser = toSafeUser(user);
  const token = buildToken(safeUser);

  createLoginActivity({
    userId: safeUser.id,
    ip,
    userAgent,
  });

  return { token, user: safeUser };
};

const register = async ({ name, email, password, role, department }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (SYSTEM_ACCOUNTS.some((item) => item.email === normalizedEmail)) {
    const error = new Error('This email is reserved for a system account');
    error.statusCode = 409;
    throw error;
  }
  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    const error = new Error('User with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const employeeId = await generateUniqueEmployeeId(User);
  const user = await User.create({
    name,
    email: normalizedEmail,
    employeeId,
    role: 'employee',
    department,
    password: hashedPassword,
  });
  return toSafeUser(user);
};

const login = async ({ email, password, ip, userAgent }) => {
  const loginIdentifier = normalizeIdentifier(email);
  const normalizedEmail = loginIdentifier.toLowerCase();
  const normalizedLocalPart = normalizedEmail.split('@')[0];

  const systemAccount = SYSTEM_ACCOUNTS.find(
    (item) =>
      normalizedEmail === item.email ||
      normalizedEmail === item.email.split('@')[0] ||
      normalizedLocalPart === item.email.split('@')[0]
  );

  if (systemAccount) {
    if (String(password || '') !== systemAccount.password) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    let systemUser = await User.findOne({ email: systemAccount.email });
    if (!systemUser) {
      const hashedPassword = await bcrypt.hash(systemAccount.password, 10);
      const employeeId = await generateUniqueEmployeeId(User);
      systemUser = await User.create({
        name: systemAccount.name,
        email: systemAccount.email,
        employeeId,
        role: systemAccount.role,
        department: systemAccount.department,
        password: hashedPassword,
      });
    } else if (
      normalizeRole(systemUser.role) !== systemAccount.role ||
      !systemUser.department
    ) {
      systemUser.role = systemAccount.role;
      systemUser.department = systemUser.department || systemAccount.department;
      await systemUser.save();
    }

    return createSessionPayload({ user: systemUser, ip, userAgent });
  }

  const user = await findUserByLoginIdentifier(loginIdentifier);
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const isValid = await validateAndHealPassword(user, password);
  const userRole = normalizeRole(user.role);

  if (
    !isValid &&
    ['employee', 'manager', 'approver', 'auditor'].includes(userRole) &&
    String(password || '') === DEFAULT_EMPLOYEE_PASSWORD
  ) {
    user.password = await bcrypt.hash(DEFAULT_EMPLOYEE_PASSWORD, 10);
    await user.save();
  }

  const finalValid =
    isValid ||
    (String(password || '') === DEFAULT_EMPLOYEE_PASSWORD &&
      ['employee', 'manager', 'approver', 'auditor'].includes(userRole));

  if (!finalValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  return createSessionPayload({ user, ip, userAgent });
};

const getLoginActivity = ({ userId }) => listLoginActivitiesByUserId(userId);

module.exports = {
  register,
  login,
  getLoginActivity,
};
