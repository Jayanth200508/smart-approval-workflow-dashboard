const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    visibility: {
      type: String,
      enum: ['INTERNAL', 'REQUESTER_VISIBLE'],
      default: 'REQUESTER_VISIBLE',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

