const workflowService = require('../../services/workflowV1.service');
const { success } = require('../../utils/responseHelpers');

const createRequest = async (req, res) =>
  success(
    res,
    await workflowService.createRequest({
      actor: req.user,
      payload: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }),
    201
  );

const getRequests = async (req, res) =>
  success(res, await workflowService.getRequests({ actor: req.user, query: req.query }));

const getMyRequests = async (req, res) =>
  success(res, await workflowService.getMyRequests({ actor: req.user, query: req.query }));

const getRequestById = async (req, res) =>
  success(res, await workflowService.getRequestById({ requestId: req.params.id, actor: req.user }));

const addAttachment = async (req, res) =>
  success(
    res,
    await workflowService.addAttachment({
      requestId: req.params.id,
      actor: req.user,
      payload: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }),
    201
  );

module.exports = {
  createRequest,
  getRequests,
  getMyRequests,
  getRequestById,
  addAttachment,
};

