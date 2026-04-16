const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { findUserById, sanitizeUser } = require('../data/mockStore');
const { getPermissionsForRole } = require('../constants/permissions');
const normalizeRole = (role) => String(role || '').toLowerCase();

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token is required',
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const dbUser = await User.findById(payload.id).lean();
    if (dbUser) {
      const role = normalizeRole(dbUser.role);
      req.user = {
        id: String(dbUser._id),
        name: dbUser.name,
        email: dbUser.email,
        role,
        permissions: getPermissionsForRole(role),
        department: dbUser.department,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
      };
      return next();
    }

    const user = findUserById(payload.id);
    if (user) {
      const safeUser = sanitizeUser(user);
      const role = normalizeRole(safeUser.role);
      req.user = {
        ...safeUser,
        role,
        permissions: getPermissionsForRole(role),
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'User not found for this token',
    });
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

const requireRole = (roles) => (req, res, next) => {
  const allowed = (Array.isArray(roles) ? roles : [roles]).map(normalizeRole);
  if (!req.user || !allowed.includes(normalizeRole(req.user.role))) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${allowed.join(' or ')}`,
    });
  }
  return next();
};

module.exports = {
  protect,
  requireRole,
};
