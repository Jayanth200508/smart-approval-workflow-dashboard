const { getPermissionsForRole } = require('../constants/permissions');

const requirePermission = (permissions) => (req, res, next) => {
  const required = Array.isArray(permissions) ? permissions : [permissions];
  const userPermissions = req.user?.permissions || getPermissionsForRole(req.user?.role);

  const hasPermission = required.some((permission) => userPermissions.includes(permission));
  if (hasPermission) return next();

  return res.status(403).json({
    success: false,
    message: `Access denied. Required permission: ${required.join(' or ')}`,
  });
};

module.exports = {
  requirePermission,
};
