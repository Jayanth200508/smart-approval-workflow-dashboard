const mongoose = require('mongoose');

const workflowLogSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    stage: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    actorId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    actorRole: {
      type: String,
      default: 'system',
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

workflowLogSchema.index({ eventType: 1, createdAt: -1 });
workflowLogSchema.index({ actorId: 1, createdAt: -1 });
workflowLogSchema.index({ stage: 1, createdAt: -1 });

module.exports = mongoose.models.WorkflowLog || mongoose.model('WorkflowLog', workflowLogSchema);