const mongoose = require('mongoose');

const requestApprovalSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
      index: true,
    },
    levelNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    actedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

requestApprovalSchema.index({ requestId: 1, levelNumber: 1 }, { unique: true });

module.exports =
  mongoose.models.RequestApproval || mongoose.model('RequestApproval', requestApprovalSchema);

