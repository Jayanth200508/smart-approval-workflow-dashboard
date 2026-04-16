// Seed script for Smart Approval Workflow Dashboard (MongoDB)
// Usage: mongosh "<MONGODB_URI>" backend/docs/mongo-seed.js

const DB_NAME = "flowpilot";
const dbx = db.getSiblingDB(DB_NAME);

function ensureCollection(name) {
  if (!dbx.getCollectionNames().includes(name)) {
    dbx.createCollection(name);
  }
}

function ensureDoc(collection, query, doc) {
  const existing = collection.findOne(query);
  if (existing) return existing;
  const result = collection.insertOne(doc);
  return collection.findOne({ _id: result.insertedId });
}

// Collections
[
  "roles",
  "departments",
  "users",
  "approvalTypes",
  "requests",
  "requestApprovals",
  "workflowLevels",
  "notifications",
  "auditLogs",
].forEach(ensureCollection);

// 1) Roles
const roleAdmin = ensureDoc(
  dbx.roles,
  { roleName: "Admin" },
  { roleName: "Admin", description: "Full system access", createdAt: new Date() }
);
const roleApprover = ensureDoc(
  dbx.roles,
  { roleName: "Approver" },
  { roleName: "Approver", description: "Can approve or reject requests", createdAt: new Date() }
);
const roleEmployee = ensureDoc(
  dbx.roles,
  { roleName: "Employee" },
  { roleName: "Employee", description: "Can submit requests", createdAt: new Date() }
);

// 2) Departments
const deptHR = ensureDoc(
  dbx.departments,
  { departmentName: "Human Resources" },
  { departmentName: "Human Resources", description: "HR related approvals", createdAt: new Date() }
);
const deptFinance = ensureDoc(
  dbx.departments,
  { departmentName: "Finance" },
  { departmentName: "Finance", description: "Finance related approvals", createdAt: new Date() }
);
const deptIT = ensureDoc(
  dbx.departments,
  { departmentName: "IT" },
  { departmentName: "IT", description: "Technical approvals", createdAt: new Date() }
);
const deptOps = ensureDoc(
  dbx.departments,
  { departmentName: "Operations" },
  { departmentName: "Operations", description: "Operational approvals", createdAt: new Date() }
);

// 3) Users
const userAdmin = ensureDoc(
  dbx.users,
  { email: "admin@example.com" },
  {
    fullName: "Sample Admin",
    email: "admin@example.com",
    passwordHash: "hashed_password_here",
    roleId: roleAdmin._id,
    departmentId: deptIT._id,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
);

// 4) Approval Types
const approvalLeave = ensureDoc(
  dbx.approvalTypes,
  { typeName: "Leave Request" },
  { typeName: "Leave Request", description: "Employee leave approval", createdAt: new Date() }
);
const approvalPurchase = ensureDoc(
  dbx.approvalTypes,
  { typeName: "Purchase Request" },
  { typeName: "Purchase Request", description: "Request for purchasing items", createdAt: new Date() }
);
const approvalBudget = ensureDoc(
  dbx.approvalTypes,
  { typeName: "Budget Approval" },
  { typeName: "Budget Approval", description: "Budget approval process", createdAt: new Date() }
);
const approvalEvent = ensureDoc(
  dbx.approvalTypes,
  { typeName: "Event Approval" },
  { typeName: "Event Approval", description: "Event organization approval", createdAt: new Date() }
);

// 5) Requests (core)
const requestLaptop = ensureDoc(
  dbx.requests,
  { requestTitle: "Laptop Purchase", userId: userAdmin._id },
  {
    requestTitle: "Laptop Purchase",
    requestDescription: "Need new laptop for development",
    userId: userAdmin._id,
    approvalTypeId: approvalPurchase._id,
    departmentId: deptIT._id,
    currentStatus: "Pending",
    workflowLevel: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
);

// 6) Request Approvals
ensureDoc(
  dbx.requestApprovals,
  { requestId: requestLaptop._id, approverId: userAdmin._id },
  {
    requestId: requestLaptop._id,
    approverId: userAdmin._id,
    approvalStatus: "Pending",
    comments: "",
    approvedAt: null,
    createdAt: new Date(),
  }
);

// 7) Workflow Levels
ensureDoc(
  dbx.workflowLevels,
  { approvalTypeId: approvalPurchase._id, levelNumber: 1, roleId: roleApprover._id },
  {
    approvalTypeId: approvalPurchase._id,
    levelNumber: 1,
    roleId: roleApprover._id,
    createdAt: new Date(),
  }
);

// 8) Notifications
ensureDoc(
  dbx.notifications,
  { userId: userAdmin._id, message: "Your request has been submitted successfully" },
  {
    userId: userAdmin._id,
    message: "Your request has been submitted successfully",
    isRead: false,
    createdAt: new Date(),
  }
);

// 9) Audit Logs
ensureDoc(
  dbx.auditLogs,
  { recordId: requestLaptop._id, actionType: "CREATE_REQUEST" },
  {
    userId: userAdmin._id,
    actionType: "CREATE_REQUEST",
    collectionName: "requests",
    recordId: requestLaptop._id,
    timestamp: new Date(),
  }
);

print(JSON.stringify({
  database: DB_NAME,
  roles: [roleAdmin._id, roleApprover._id, roleEmployee._id],
  departments: [deptHR._id, deptFinance._id, deptIT._id, deptOps._id],
  user: userAdmin._id,
  approvalTypes: [approvalLeave._id, approvalPurchase._id, approvalBudget._id, approvalEvent._id],
  request: requestLaptop._id,
}));
