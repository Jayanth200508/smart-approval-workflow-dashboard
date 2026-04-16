const aiApprovalEngineService = require('../services/aiApprovalEngine.service');
const { success } = require('../utils/responseHelpers');

const createRequest = async (req, res) =>
  success(
    res,
    await aiApprovalEngineService.createRequestWithPrediction({
      actor: req.user,
      payload: req.body,
    }),
    201
  );

const getPrediction = async (req, res) =>
  success(res, await aiApprovalEngineService.ensurePredictionForRequest(req.params.id));

const escalate = async (req, res) =>
  success(
    res,
    await aiApprovalEngineService.escalateRequest({
      requestId: req.params.id,
      reason: req.body?.reason,
      triggeredBy: req.user,
      autoEscalated: false,
    })
  );

const getDashboardAnalytics = async (_req, res) =>
  success(res, await aiApprovalEngineService.getDashboardAnalytics());

module.exports = {
  createRequest,
  getPrediction,
  escalate,
  getDashboardAnalytics,
};
