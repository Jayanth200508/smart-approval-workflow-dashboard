const workflowService = require('../../services/workflowV1.service');
const { success } = require('../../utils/responseHelpers');

const getSummary = async (req, res) =>
  success(res, await workflowService.getDashboardSummary({ actor: req.user }));

module.exports = {
  getSummary,
};

