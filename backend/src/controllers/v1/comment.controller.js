const workflowService = require('../../services/workflowV1.service');
const { success } = require('../../utils/responseHelpers');

const addComment = async (req, res) =>
  success(
    res,
    await workflowService.addComment({
      requestId: req.params.id,
      actor: req.user,
      payload: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }),
    201
  );

const getComments = async (req, res) =>
  success(
    res,
    await workflowService.getComments({
      requestId: req.params.id,
      actor: req.user,
    })
  );

module.exports = {
  addComment,
  getComments,
};

