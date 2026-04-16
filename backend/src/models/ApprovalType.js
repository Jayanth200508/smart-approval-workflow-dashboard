const mongoose = require('mongoose');

const approvalTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

approvalTypeSchema.index({ name: 1, departmentId: 1 }, { unique: true });

module.exports = mongoose.models.ApprovalType || mongoose.model('ApprovalType', approvalTypeSchema);

