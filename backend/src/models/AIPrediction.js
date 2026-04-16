const mongoose = require('mongoose');

const aiPredictionSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
      index: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      required: true,
      index: true,
    },
    predictedDelayHours: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    predictedCompletionDate: {
      type: Date,
      required: true,
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
    smartRouteRecommendation: {
      type: [String],
      default: [],
    },
    bottleneckWarnings: {
      type: [String],
      default: [],
    },
    modelVersion: {
      type: String,
      default: 'rule-engine-v1',
      trim: true,
      maxlength: 50,
    },
    inputSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'ai_predictions',
  }
);

aiPredictionSchema.index({ requestId: 1, createdAt: -1 });
aiPredictionSchema.index({ riskLevel: 1, createdAt: -1 });

module.exports = mongoose.models.AIPrediction || mongoose.model('AIPrediction', aiPredictionSchema);
