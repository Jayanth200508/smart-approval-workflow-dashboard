const authService = require('../../services/auth.service');
const { success } = require('../../utils/responseHelpers');

const register = async (req, res) => {
  const user = await authService.register(req.body);
  return success(res, user, 201);
};

const login = async (req, res) => {
  const payload = await authService.login({
    ...req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return success(res, payload);
};

const me = async (req, res) => success(res, req.user);

module.exports = {
  register,
  login,
  me,
};

