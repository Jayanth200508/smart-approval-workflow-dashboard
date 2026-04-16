export const seedRoles = [
  { id: "role-admin", name: "admin" },
  { id: "role-manager", name: "manager" },
  { id: "role-employee", name: "employee" },
];

export const seedDepartments = [
  { id: "dep-dev", name: "Software Development" },
  { id: "dep-qa", name: "Quality Assurance" },
  { id: "dep-devops", name: "DevOps / Cloud Infrastructure" },
  { id: "dep-cyber", name: "Cybersecurity" },
  { id: "dep-it", name: "IT Support" },
  { id: "dep-hr", name: "Human Resources" },
  { id: "dep-fin", name: "Finance" },
  { id: "dep-pmo", name: "Project Management Office (PMO)" },
  { id: "dep-client", name: "Client Services" },
  { id: "dep-rnd", name: "Research and Innovation" },
];

export const seedRequestTypes = [
  { id: "rt-001", name: "Laptop / Hardware Request" },
  { id: "rt-002", name: "Software Installation Request" },
  { id: "rt-003", name: "VPN Access Request" },
  { id: "rt-004", name: "Leave Request" },
  { id: "rt-005", name: "Work From Home Request" },
  { id: "rt-006", name: "IT Support Ticket" },
  { id: "rt-007", name: "Bug Escalation Request" },
  { id: "rt-008", name: "Production Incident Report" },
  { id: "rt-009", name: "Training / Certification Request" },
  { id: "rt-010", name: "Travel Approval Request" },
  { id: "rt-011", name: "Expense Reimbursement Request" },
  { id: "rt-012", name: "Department Change Request" },
];

export const seedUsers = [
  {
    id: "u-001",
    fullName: "Jayanth Admin",
    email: "jayanth.se23@bitsathy.ac.in",
    password: "1234qwer",
    role: "admin",
    department: "Executive",
  },
  {
    id: "u-002",
    fullName: "Logesh",
    email: "logesh@gmail.com",
    password: "1234qwert",
    role: "employee",
    department: "Software Development",
  },
  {
    id: "u-003",
    fullName: "Vikram Menon",
    email: "manager.dev@smartflow.com",
    password: "password123",
    role: "manager",
    department: "Software Development",
  },
  {
    id: "u-004",
    fullName: "Ravi Kumar",
    email: "ravi@smartflow.com",
    password: "password123",
    role: "employee",
    department: "IT Support",
  },
  {
    id: "u-005",
    fullName: "Neha Verma",
    email: "manager.it@smartflow.com",
    password: "password123",
    role: "manager",
    department: "IT Support",
  },
  {
    id: "u-006",
    fullName: "Priya Nair",
    email: "priya@smartflow.com",
    password: "password123",
    role: "employee",
    department: "Quality Assurance",
  },
];

const toDateIso = (daysAgo, hour = 10) => {
  const dt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  dt.setHours(hour, 20, 0, 0);
  return dt.toISOString();
};

export const seedRequests = [
  {
    id: "REQ101",
    title: "Software Installation for Client Delivery",
    type: "Software Installation Request",
    requesterId: "u-002",
    requesterName: "Ananya Rao",
    department: "Software Development",
    amount: 5200,
    priority: "High",
    status: "Pending Manager Approval",
    submittedAt: toDateIso(1, 9),
    lastUpdated: toDateIso(1, 9),
    approverName: "",
    description:
      "Need licensed testing and profiling tools installed for sprint release.",
    decisionComment: "",
    attachments: [],
  },
  {
    id: "REQ102",
    title: "VPN Access for Offshore Collaboration",
    type: "VPN Access Request",
    requesterId: "u-002",
    requesterName: "Ananya Rao",
    department: "Software Development",
    amount: 1800,
    priority: "Medium",
    status: "Approved",
    submittedAt: toDateIso(4, 11),
    lastUpdated: toDateIso(3, 16),
    approverName: "Jayanth Admin",
    description: "VPN profile needed for secure access to client environments.",
    decisionComment: "Approved based on project requirements.",
    attachments: ["vpn-request-note.pdf"],
  },
  {
    id: "REQ103",
    title: "Critical Production Incident Report",
    type: "Production Incident Report",
    department: "IT Support",
    requesterId: "u-004",
    requesterName: "Ravi Kumar",
    amount: 3500,
    priority: "Low",
    status: "Pending Admin Approval",
    submittedAt: toDateIso(7, 10),
    lastUpdated: toDateIso(6, 13),
    approverName: "Neha Verma",
    description: "Service outage escalation affecting ticket routing workflow.",
    decisionComment: "Escalated to admin for final decision.",
    attachments: [],
  },
];

export const seedRequestEvents = [
  {
    id: "evt-101-1",
    requestId: "REQ101",
    action: "request_submitted",
    actorName: "Ananya Rao",
    actorRole: "employee",
    status: "Pending Manager Approval",
    comment: "Request Submitted",
    timestamp: toDateIso(1, 9),
  },
  {
    id: "evt-102-1",
    requestId: "REQ102",
    action: "request_submitted",
    actorName: "Ananya Rao",
    actorRole: "employee",
    status: "Pending Manager Approval",
    comment: "Request Submitted",
    timestamp: toDateIso(4, 11),
  },
  {
    id: "evt-102-2a",
    requestId: "REQ102",
    action: "request_approved",
    actorName: "Vikram Menon",
    actorRole: "manager",
    status: "Approved",
    comment: "Approved based on project requirements.",
    timestamp: toDateIso(3, 13),
  },
  {
    id: "evt-102-2",
    requestId: "REQ102",
    action: "request_approved",
    actorName: "Jayanth Admin",
    actorRole: "admin",
    status: "Approved",
    comment: "Admin Approved",
    timestamp: toDateIso(3, 16),
  },
  {
    id: "evt-103-1",
    requestId: "REQ103",
    action: "request_submitted",
    actorName: "Ravi Kumar",
    actorRole: "employee",
    status: "Pending Manager Approval",
    comment: "Request Submitted",
    timestamp: toDateIso(7, 10),
  },
  {
    id: "evt-103-2",
    requestId: "REQ103",
    action: "request_escalated",
    actorName: "Neha Verma",
    actorRole: "manager",
    status: "Pending Admin Approval",
    comment: "Escalated to admin due to production impact.",
    timestamp: toDateIso(6, 13),
  },
];

export const seedActivityLogs = [
  {
    id: "act-1",
    timestamp: toDateIso(1, 9),
    userName: "Ananya Rao",
    role: "employee",
    action: "Request submitted",
    requestId: "REQ101",
    status: "Pending Manager Approval",
  },
  {
    id: "act-2",
    timestamp: toDateIso(3, 13),
    userName: "Vikram Menon",
    role: "manager",
    action: "Request approved",
    requestId: "REQ102",
    status: "Approved",
  },
];

export const seedNotifications = [
  {
    id: "not-1",
    userId: "u-002",
    title: "Request approved",
    message: "VPN Access for Offshore Collaboration was approved.",
    tone: "success",
    read: false,
    timestamp: toDateIso(3, 16),
  },
];

export const seedAnnouncements = [
  {
    id: "ann-1",
    title: "Plant Maintenance Window",
    message:
      "Scheduled maintenance is planned tomorrow from 10:00 PM to 12:00 AM.",
    createdBy: "Jayanth Admin",
    createdAt: toDateIso(2, 12),
  },
];
