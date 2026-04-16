const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'skipped'],
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    requestId: {
      type: String,
      default: '',
      trim: true,
    },
    errorMessage: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
