const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },
    type: {
      type: String,
      default: 'General',
      trim: true,
      maxlength: 80,
    },
    department: {
      type: String,
      default: 'General',
      trim: true,
      maxlength: 80,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    approvalTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalType',
      required: true,
      index: true,
    },
    currentLevel: {
      type: Number,
      default: 1,
      min: 1,
    },
    currentApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    currentApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ESCALATED'],
      default: 'PENDING',
      index: true,
    },
    aiRiskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low',
      index: true,
    },
    predictedDelay: {
      type: Number,
      default: 0,
      min: 0,
    },
    predictedDelayHours: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    predictedCompletionDate: {
      type: Date,
      default: null,
      index: true,
    },
    aiSummary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    requiredDocuments: {
      type: [String],
      default: [],
    },
    missingDocuments: {
      type: [String],
      default: [],
    },
    routeRecommendations: {
      type: [String],
      default: [],
    },
    bottleneckWarnings: {
      type: [String],
      default: [],
    },
    lastPredictionAt: {
      type: Date,
      default: null,
    },
    escalationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastEscalatedAt: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      enum: ['workflow_v1', 'ai_engine'],
      default: 'workflow_v1',
      index: true,
    },
    legacyRequestId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

requestSchema.index({ requesterId: 1, createdAt: -1 });
requestSchema.index({ department: 1, status: 1, createdAt: -1 });
requestSchema.index({ currentApprover: 1, status: 1, createdAt: -1 });
requestSchema.index({ predictedCompletionDate: 1, status: 1 });

module.exports = mongoose.models.Request || mongoose.model('Request', requestSchema);
