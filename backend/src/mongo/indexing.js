const Request = require('../models/Request');
const RequestApproval = require('../models/RequestApproval');
const AuditLog = require('../models/AuditLog');
const StatusHistory = require('../models/StatusHistory');
const PredictionSnapshot = require('../models/PredictionSnapshot');
const WorkflowLog = require('../models/WorkflowLog');
const ApprovalLog = require('../models/ApprovalLog');
const Escalation = require('../models/Escalation');
const AIPrediction = require('../models/AIPrediction');
const logger = require('../utils/logger');

const ensureMongoIndexes = async () => {
  try {
    await Promise.all([
      Request.createIndexes(),
      RequestApproval.createIndexes(),
      AuditLog.createIndexes(),
      StatusHistory.createIndexes(),
      PredictionSnapshot.createIndexes(),
      WorkflowLog.createIndexes(),
      ApprovalLog.createIndexes(),
      Escalation.createIndexes(),
      AIPrediction.createIndexes(),
    ]);

    logger.info('MongoDB indexes ensured for workflow analytics collections');
    return true;
  } catch (error) {
    logger.warn('MongoDB index ensure skipped/failed', { message: error.message });
    return false;
  }
};

module.exports = {
  ensureMongoIndexes,
};
