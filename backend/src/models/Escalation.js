const mongoose = require('mongoose');

const escalationSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
      index: true,
    },
    fromApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    toApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reason: {
      type: String,
      default: 'SLA threshold crossed',
      trim: true,
      maxlength: 500,
    },
    escalatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    autoEscalated: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['OPEN', 'RESOLVED'],
      default: 'OPEN',
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'escalations',
  }
);

escalationSchema.index({ requestId: 1, escalatedAt: -1 });
escalationSchema.index({ status: 1, escalatedAt: -1 });

module.exports = mongoose.models.Escalation || mongoose.model('Escalation', escalationSchema);
