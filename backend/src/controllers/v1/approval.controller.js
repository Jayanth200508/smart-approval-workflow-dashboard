const workflowService = require('../../services/workflowV1.service');
const { success } = require('../../utils/responseHelpers');

const getPendingApprovals = async (req, res) =>
  success(res, await workflowService.getPendingApprovals({ actor: req.user }));

const approveRequest = async (req, res) =>
  success(
    res,
    await workflowService.approveRequest({
      requestId: req.params.id,
      actor: req.user,
      comment: req.body.comment,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })
  );

const rejectRequest = async (req, res) =>
  success(
    res,
    await workflowService.rejectRequest({
      requestId: req.params.id,
      actor: req.user,
      comment: req.body.comment,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })
  );

module.exports = {
  getPendingApprovals,
  approveRequest,
  rejectRequest,
};

