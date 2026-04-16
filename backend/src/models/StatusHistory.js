const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
      index: true,
    },
    fromStatus: {
      type: String,
      default: '',
      trim: true,
    },
    toStatus: {
      type: String,
      required: true,
      trim: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.StatusHistory || mongoose.model('StatusHistory', statusHistorySchema);

