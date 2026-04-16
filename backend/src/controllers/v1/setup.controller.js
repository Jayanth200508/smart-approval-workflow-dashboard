const ApprovalType = require('../../models/ApprovalType');
const Department = require('../../models/Department');
const Role = require('../../models/Role');
const WorkflowLevel = require('../../models/WorkflowLevel');
const { initializeSystemData } = require('../../services/systemSetup.service');
const { success } = require('../../utils/responseHelpers');

const initialize = async (_req, res) => success(res, await initializeSystemData());

const getMasterData = async (_req, res) => {
  const [roles, departments, approvalTypes, workflowLevels] = await Promise.all([
    Role.find({}).sort({ name: 1 }).lean(),
    Department.find({}).sort({ name: 1 }).lean(),
    ApprovalType.find({}).sort({ name: 1 }).lean(),
    WorkflowLevel.find({}).sort({ approvalTypeId: 1, levelNumber: 1 }).lean(),
  ]);

  return success(res, {
    roles,
    departments,
    approvalTypes,
    workflowLevels,
  });
};

module.exports = {
  initialize,
  getMasterData,
};

