const config = require('../config');
const logger = require('../utils/logger');
const intelligenceService = require('../services/intelligence.service');
const aiApprovalEngineService = require('../services/aiApprovalEngine.service');

let monitorTimer = null;

const startWorkflowMonitorScheduler = () => {
  if (!config.workflowMonitorEnabled) {
    logger.info('Workflow monitor scheduler is disabled by configuration');
    return null;
  }

  if (monitorTimer) return monitorTimer;

  monitorTimer = setInterval(() => {
    try {
      const result = intelligenceService.monitorWorkflowAndEscalate({ dryRun: false });
      if (result.escalatedCount || result.reroutedCount) {
        logger.info('Workflow monitor cycle completed with actions', {
          escalatedCount: result.escalatedCount,
          reroutedCount: result.reroutedCount,
        });
      }

      Promise.resolve(aiApprovalEngineService.runAutoEscalationSweep())
        .then((aiResult) => {
          if (aiResult?.escalated) {
            logger.info('AI escalation sweep completed with actions', {
              checked: aiResult.checked,
              escalated: aiResult.escalated,
              skipped: aiResult.skipped,
            });
          }
        })
        .catch((error) => {
          logger.warn('AI escalation sweep failed', { message: error.message });
        });
    } catch (error) {
      logger.error('Workflow monitor scheduler cycle failed', { message: error.message });
    }
  }, Math.max(15000, Number(config.workflowMonitorIntervalMs || 60000)));

  logger.info('Workflow monitor scheduler started', {
    intervalMs: Math.max(15000, Number(config.workflowMonitorIntervalMs || 60000)),
    inactivityThresholdHours: config.workflowInactivityThresholdHours,
    escalationThresholdHours: config.workflowEscalationThresholdHours,
  });

  return monitorTimer;
};

const stopWorkflowMonitorScheduler = () => {
  if (!monitorTimer) return;
  clearInterval(monitorTimer);
  monitorTimer = null;
  logger.info('Workflow monitor scheduler stopped');
};

module.exports = {
  startWorkflowMonitorScheduler,
  stopWorkflowMonitorScheduler,
};
