const mongoose = require('mongoose');

const approvalLogSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
      index: true,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'REMINDER_SENT',
        'ESCALATED',
        'AUTO_ESCALATED',
        'ROUTE_RECOMMENDED',
      ],
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    timeTaken: {
      type: Number,
      default: 0,
      min: 0,
    },
    department: {
      type: String,
      default: 'General',
      trim: true,
      maxlength: 80,
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'approval_logs',
  }
);

approvalLogSchema.index({ requestId: 1, action: 1, timestamp: -1 });
approvalLogSchema.index({ approverId: 1, action: 1, timestamp: -1 });

module.exports = mongoose.models.ApprovalLog || mongoose.model('ApprovalLog', approvalLogSchema);
