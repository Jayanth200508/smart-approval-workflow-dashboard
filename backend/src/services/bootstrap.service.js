const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../utils/logger');
const { generateUniqueEmployeeId } = require('../utils/employeeId');
const { replaceUsers, seedDemoUsers } = require('../data/mockStore');

const SYSTEM_ACCOUNTS = [
  {
    name: 'Demo Employee',
    email: 'logesh@gmail.com',
    role: 'employee',
    department: 'Operations',
    password: '1234qwert',
  },
  {
    name: 'Demo Manager',
    email: 'manager@flowpilot.com',
    role: 'manager',
    department: 'Finance',
    password: 'password123',
  },
  {
    name: 'Demo Manager',
    email: 'manager@smartflow.com',
    role: 'manager',
    department: 'Finance',
    password: 'password123',
  },
  {
    name: 'Demo Admin',
    email: 'admin@flowpilot.com',
    role: 'admin',
    department: 'Executive',
    password: 'password123',
  },
  {
    name: 'Demo Admin',
    email: 'admin@smartflow.com',
    role: 'admin',
    department: 'Executive',
    password: 'password123',
  },
  {
    name: 'Demo Employee',
    email: 'employee@flowpilot.com',
    role: 'employee',
    department: 'Operations',
    password: 'password123',
  },
  {
    name: 'Demo Employee',
    email: 'employee@smartflow.com',
    role: 'employee',
    department: 'Operations',
    password: 'password123',
  },
  {
    name: 'Jayanth Admin',
    email: 'jayanth.se23@bitsathy.ac.in',
    role: 'admin',
    department: 'Executive',
    password: '1234qwer',
  },
  {
    name: 'Jayanth Admin',
    email: 'jayanthnitish@gmail.com',
    role: 'admin',
    department: 'Executive',
    password: '1234qwert',
  },
];

const isBcryptHash = (value = '') => /^\$2[aby]\$\d{2}\$/.test(String(value));

const ensureSingleAccount = async (spec) => {
  const normalizedEmail = String(spec.email || '').trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const employeeId = await generateUniqueEmployeeId(User);
    user = await User.create({
      name: spec.name,
      email: normalizedEmail,
      role: spec.role,
      department: spec.department,
      employeeId,
      password: await bcrypt.hash(spec.password, 10),
    });
    return user;
  }

  let changed = false;
  if (String(user.role || '').toLowerCase() !== spec.role) {
    user.role = spec.role;
    changed = true;
  }
  if (!user.department && spec.department) {
    user.department = spec.department;
    changed = true;
  }
  if (!user.employeeId) {
    user.employeeId = await generateUniqueEmployeeId(User);
    changed = true;
  }
  if (!isBcryptHash(user.password)) {
    user.password = await bcrypt.hash(spec.password, 10);
    changed = true;
  }

  if (changed) await user.save();
  return user;
};

const syncWorkflowUsersFromDb = async () => {
  const dbUsers = await User.find({}, { name: 1, email: 1, role: 1, department: 1, password: 1 }).lean();
  replaceUsers(
    dbUsers.map((item) => ({
      id: String(item._id),
      name: item.name,
      email: item.email,
      role: String(item.role || '').toLowerCase(),
      department: item.department,
      password: item.password,
      createdAt: new Date().toISOString(),
    }))
  );
};

const bootstrapWorkflowData = async ({ dbConnected }) => {
  if (!dbConnected) {
    seedDemoUsers();
    logger.info('Workflow store initialized in fallback mode (in-memory demo users)');
    return;
  }

  for (const account of SYSTEM_ACCOUNTS) {
    // eslint-disable-next-line no-await-in-loop
    await ensureSingleAccount(account);
  }
  await syncWorkflowUsersFromDb();
  logger.info('Workflow bootstrap completed (system users synced)');
};

module.exports = {
  SYSTEM_ACCOUNTS,
  bootstrapWorkflowData,
};
