const analyticsService = require('../services/analytics.service');
const { success } = require('../utils/responseHelpers');

const getAnalytics = async (_req, res) => success(res, analyticsService.getAnalytics());
const getManagerAnalytics = async (_req, res) => success(res, analyticsService.getManagerAnalytics());

module.exports = {
  getAnalytics,
  getManagerAnalytics,
};
