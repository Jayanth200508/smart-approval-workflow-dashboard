const intelligenceService = require('../services/intelligence.service');
const exportService = require('../services/export.service');
const {
  toPredictionDto,
  toBottleneckDto,
  toFairnessDto,
  toDigitalTwinDto,
} = require('../dto/intelligence.dto');
const { success } = require('../utils/responseHelpers');

const getSnapshot = async (_req, res) => success(res, intelligenceService.getIntelligenceSnapshot());

const predictApproval = async (req, res) => {
  const result = intelligenceService.predictApprovalOutcome({
    title: req.body?.title,
    type: req.body?.type,
    department: req.body?.department,
    amount: Number(req.body?.amount || 0),
    priority: req.body?.priority,
    urgency: req.body?.urgency,
    description: req.body?.description,
    attachments: req.body?.attachments || [],
    expectedDate: req.body?.expectedDate,
  });
  return success(res, toPredictionDto(result));
};

const runSimulation = async (req, res) => {
  const result = intelligenceService.runSimulation({
    department: req.body?.department,
    amount: Number(req.body?.amount || 0),
    priority: req.body?.priority,
  });
  return success(res, result);
};

const getBottlenecks = async (_req, res) => {
  const result = intelligenceService.getAdaptiveWorkflowInsights();
  return success(res, toBottleneckDto(result));
};

const rerouteRequest = async (req, res) => {
  const result = intelligenceService.rerouteRequest({
    requestId: req.params.requestId,
    reason: req.body?.reason,
    requestedBy: req.user,
  });
  return success(res, result);
};

const runWorkflowMonitor = async (req, res) => {
  const result = intelligenceService.monitorWorkflowAndEscalate({
    dryRun: Boolean(req.body?.dryRun),
  });
  return success(res, result);
};

const getFairnessDiagnostics = async (_req, res) => {
  const result = intelligenceService.getFairnessDiagnostics();
  return success(res, toFairnessDto(result));
};

const runDigitalTwinSimulation = async (req, res) => {
  const result = intelligenceService.simulateDigitalTwin({
    stageMap: req.body?.stageMap,
    horizonDays: req.body?.horizonDays,
    incomingVolumePerDay: req.body?.incomingVolumePerDay,
  });
  return success(res, toDigitalTwinDto(result));
};

const getProcessDna = async (req, res) => {
  const department = req.params.department;
  return success(res, intelligenceService.getProcessDnaByDepartment(department));
};

const exportProcessDnaPdf = async (req, res) => {
  const department = req.params.department;
  const lines = intelligenceService.getProcessDnaReportLines(department);
  const pdf = exportService.makeSimplePdfBuffer(
    `Infosys Approval System Process DNA Report (${department})`,
    lines,
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="process-dna-${department.toLowerCase()}.pdf"`);
  return res.status(200).send(pdf);
};

module.exports = {
  getSnapshot,
  predictApproval,
  runSimulation,
  getBottlenecks,
  rerouteRequest,
  runWorkflowMonitor,
  getFairnessDiagnostics,
  runDigitalTwinSimulation,
  getProcessDna,
  exportProcessDnaPdf,
};
