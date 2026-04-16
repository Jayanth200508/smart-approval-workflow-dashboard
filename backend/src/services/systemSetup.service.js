const ApprovalType = require('../models/ApprovalType');
const Department = require('../models/Department');
const Role = require('../models/Role');
const User = require('../models/User');
const WorkflowLevel = require('../models/WorkflowLevel');

const seedRoles = async () => {
  const roleSpecs = [
    {
      name: 'ADMIN',
      description: 'System administrator',
      permissions: ['manage_users', 'manage_workflows', 'view_all_requests'],
    },
    {
      name: 'APPROVER',
      description: 'Approves workflow requests',
      permissions: ['review_requests', 'approve_requests'],
    },
    {
      name: 'EMPLOYEE',
      description: 'Submits and tracks own requests',
      permissions: ['create_requests', 'view_own_requests'],
    },
  ];

  const roles = [];
  for (const spec of roleSpecs) {
    // eslint-disable-next-line no-await-in-loop
    const role = await Role.findOneAndUpdate({ name: spec.name }, spec, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    roles.push(role);
  }
  return roles;
};

const seedDepartments = async () => {
  const specs = [
    { name: 'Operations', code: 'OPS', isActive: true },
    { name: 'Finance', code: 'FIN', isActive: true },
    { name: 'Human Resources', code: 'HR', isActive: true },
  ];

  const departments = [];
  for (const spec of specs) {
    // eslint-disable-next-line no-await-in-loop
    const dep = await Department.findOneAndUpdate({ code: spec.code }, spec, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    departments.push(dep);
  }
  return departments;
};

const seedApprovalTypes = async ({ financeDepartmentId }) => {
  const specs = [
    {
      name: 'PURCHASE_REQUEST',
      description: 'Purchase approval workflow',
      departmentId: financeDepartmentId || null,
      isActive: true,
    },
    {
      name: 'LEAVE_REQUEST',
      description: 'Leave approval workflow',
      departmentId: null,
      isActive: true,
    },
  ];

  const types = [];
  for (const spec of specs) {
    // eslint-disable-next-line no-await-in-loop
    const type = await ApprovalType.findOneAndUpdate(
      { name: spec.name, departmentId: spec.departmentId || null },
      spec,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    types.push(type);
  }
  return types;
};

const mapUsersToRoleRefs = async ({ roleMap, departmentMap }) => {
  const users = await User.find({}).select('_id role department roleId departmentId');
  for (const user of users) {
    const normalizedRole = String(user.role || 'employee').toLowerCase();
    if (normalizedRole !== user.role) user.role = normalizedRole;

    const roleAliasMap = {
      ADMIN: 'ADMIN',
      APPROVER: 'APPROVER',
      EMPLOYEE: 'EMPLOYEE',
      MANAGER: 'APPROVER',
      AUDITOR: 'APPROVER',
    };
    const roleKey = roleAliasMap[String(user.role || '').toUpperCase()] || 'EMPLOYEE';
    if (roleMap[roleKey] && !user.roleId) user.roleId = roleMap[roleKey]._id;

    if (!user.departmentId && user.department) {
      const department = Object.values(departmentMap).find(
        (item) => item.name.toLowerCase() === String(user.department).toLowerCase()
      );
      if (department) user.departmentId = department._id;
    }

    // eslint-disable-next-line no-await-in-loop
    await user.save();
  }
};

const seedWorkflowLevels = async ({ approvalTypes, roleMap, financeDepartmentId }) => {
  const purchaseType = approvalTypes.find((item) => item.name === 'PURCHASE_REQUEST');
  if (purchaseType) {
    await WorkflowLevel.findOneAndUpdate(
      { approvalTypeId: purchaseType._id, departmentId: financeDepartmentId || null, levelNumber: 1 },
      {
        approvalTypeId: purchaseType._id,
        departmentId: financeDepartmentId || null,
        levelNumber: 1,
        approverRoleId: roleMap.APPROVER._id,
        approverUserId: null,
        isRequired: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await WorkflowLevel.findOneAndUpdate(
      { approvalTypeId: purchaseType._id, departmentId: financeDepartmentId || null, levelNumber: 2 },
      {
        approvalTypeId: purchaseType._id,
        departmentId: financeDepartmentId || null,
        levelNumber: 2,
        approverRoleId: roleMap.ADMIN._id,
        approverUserId: null,
        isRequired: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const leaveType = approvalTypes.find((item) => item.name === 'LEAVE_REQUEST');
  if (leaveType) {
    await WorkflowLevel.findOneAndUpdate(
      { approvalTypeId: leaveType._id, departmentId: null, levelNumber: 1 },
      {
        approvalTypeId: leaveType._id,
        departmentId: null,
        levelNumber: 1,
        approverRoleId: roleMap.APPROVER._id,
        approverUserId: null,
        isRequired: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

const initializeSystemData = async () => {
  const roles = await seedRoles();
  const roleMap = roles.reduce((acc, role) => ({ ...acc, [role.name]: role }), {});

  const departments = await seedDepartments();
  const departmentMap = departments.reduce((acc, dep) => ({ ...acc, [dep.code]: dep }), {});

  const financeDepartmentId = departmentMap.FIN?._id || null;
  const approvalTypes = await seedApprovalTypes({ financeDepartmentId });
  await seedWorkflowLevels({ approvalTypes, roleMap, financeDepartmentId });
  await mapUsersToRoleRefs({ roleMap, departmentMap });

  return {
    roles: roles.length,
    departments: departments.length,
    approvalTypes: approvalTypes.length,
  };
};

module.exports = {
  initializeSystemData,
};
