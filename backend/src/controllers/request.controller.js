const requestService = require('../services/request.service');
const { success } = require('../utils/responseHelpers');

const createRequest = async (req, res) => {
  const request = requestService.createRequest({ body: req.body, user: req.user });
  return success(res, request, 201);
};

const getMyRequests = async (req, res) =>
  success(
    res,
    requestService.getMyRequests({
      userId: req.user.id,
      filters: req.query,
    })
  );

const getRequestsByRole = async (req, res) =>
  success(
    res,
    requestService.getAllRequestsByRole({
      user: req.user,
    })
  );

const getManagerQueue = async (req, res) =>
  success(
    res,
    requestService.getManagerQueue({
      filters: req.query,
      user: req.user,
    })
  );

const getRequestById = async (req, res) =>
  success(res, requestService.getRequestById({ requestId: req.params.id, user: req.user }));

const withdrawRequest = async (req, res) =>
  success(
    res,
    requestService.withdrawRequest({
      requestId: req.params.id,
      user: req.user,
      comment: req.body.comment,
    })
  );

const managerApprove = async (req, res) =>
  success(
    res,
    requestService.managerApprove({
      requestId: req.params.id,
      user: req.user,
      comment: req.body.comment,
    })
  );

const managerReject = async (req, res) =>
  success(
    res,
    requestService.managerReject({
      requestId: req.params.id,
      user: req.user,
      comment: req.body.comment,
    })
  );

const managerBulkAction = async (req, res) =>
  success(
    res,
    requestService.bulkManagerAction({
      requestIds: req.body.requestIds,
      user: req.user,
      action: req.body.action,
      comment: req.body.comment,
    })
  );

const createHighAmountApprovalConfirmation = async (req, res) =>
  success(
    res,
    requestService.createHighAmountApprovalConfirmation({
      requestId: req.params.id,
      user: req.user,
    })
  );

const adminApprove = async (req, res) =>
  success(
    res,
    requestService.adminApprove({
      requestId: req.params.id,
      user: req.user,
      comment: req.body.comment,
      confirmationToken: req.body.confirmationToken,
    })
  );

const adminReject = async (req, res) =>
  success(
    res,
    requestService.adminReject({
      requestId: req.params.id,
      user: req.user,
      comment: req.body.comment,
    })
  );

const addComment = async (req, res) =>
  success(
    res,
    requestService.addComment({
      requestId: req.params.id,
      user: req.user,
      comment: req.body.comment,
    })
  );

const setProxyApprover = async (req, res) =>
  success(
    res,
    requestService.setProxyApprover({
      delegatorId: req.body.delegatorId,
      delegateId: req.body.delegateId,
      activeUntil: req.body.activeUntil,
      user: req.user,
    })
  );

const clearProxyApprover = async (req, res) =>
  success(
    res,
    requestService.clearProxyApprover({
      delegatorId: req.params.delegatorId,
      user: req.user,
    })
  );

const runSlaEscalation = async (_req, res) => success(res, requestService.runSlaEscalation());

module.exports = {
  createRequest,
  getMyRequests,
  getRequestsByRole,
  getManagerQueue,
  getRequestById,
  withdrawRequest,
  managerApprove,
  managerReject,
  managerBulkAction,
  createHighAmountApprovalConfirmation,
  adminApprove,
  adminReject,
  addComment,
  setProxyApprover,
  clearProxyApprover,
  runSlaEscalation,
};

