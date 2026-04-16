const mongoose = require('mongoose');

const predictionSnapshotSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    requestType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    approvalChance: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    estimatedApprovalHours: {
      type: Number,
      required: true,
      min: 0,
    },
    signals: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

predictionSnapshotSchema.index({ department: 1, requestType: 1, createdAt: -1 });
predictionSnapshotSchema.index({ approvalChance: -1, createdAt: -1 });

module.exports =
  mongoose.models.PredictionSnapshot ||
  mongoose.model('PredictionSnapshot', predictionSnapshotSchema);