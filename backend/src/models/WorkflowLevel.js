const mongoose = require('mongoose');

const workflowLevelSchema = new mongoose.Schema(
  {
    approvalTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalType',
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    levelNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    approverRoleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
    },
    approverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

workflowLevelSchema.index(
  { approvalTypeId: 1, departmentId: 1, levelNumber: 1 },
  { unique: true }
);

module.exports = mongoose.models.WorkflowLevel || mongoose.model('WorkflowLevel', workflowLevelSchema);

