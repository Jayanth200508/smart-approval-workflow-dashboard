const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const userSeedSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    employeeId: { type: String, required: true, unique: true, trim: true },
    role: { type: String, required: true, enum: ['Admin', 'Manager', 'Employee', 'Approver'] },
    department: { type: String, required: true, enum: ['Finance', 'HR', 'IT', 'Operations', 'Procurement', 'Legal'] },
    phone: { type: String, required: true, match: /^\+91[6-9]\d{9}$/ },
    status: { type: String, required: true, enum: ['active'], default: 'active' },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    collection: 'users',
  }
);

const SeedUser = mongoose.models.SeedUser || mongoose.model('SeedUser', userSeedSchema);

const FIRST_NAMES = [
  'Aarav',
  'Arjun',
  'Aditya',
  'Rahul',
  'Rohan',
  'Karan',
  'Vikram',
  'Siddharth',
  'Manish',
  'Aniket',
  'Nikhil',
  'Akshay',
  'Abhishek',
  'Varun',
  'Yash',
  'Ritesh',
  'Harsh',
  'Aman',
  'Neeraj',
  'Pranav',
  'Priya',
  'Sneha',
  'Kavya',
  'Ananya',
  'Pooja',
  'Neha',
  'Isha',
  'Aditi',
  'Riya',
  'Meera',
  'Shruti',
  'Nisha',
  'Divya',
  'Swati',
  'Komal',
  'Rashmi',
  'Ishita',
  'Tanvi',
  'Shreya',
  'Bhavna',
];

const LAST_NAMES = [
  'Sharma',
  'Verma',
  'Gupta',
  'Patel',
  'Singh',
  'Kumar',
  'Mishra',
  'Reddy',
  'Nair',
  'Iyer',
  'Chopra',
  'Joshi',
  'Khanna',
  'Bansal',
  'Mehta',
  'Kapoor',
  'Pandey',
  'Agarwal',
  'Chauhan',
  'Saxena',
  'Malhotra',
  'Tiwari',
  'Deshmukh',
  'Kulkarni',
  'Ghosh',
  'Mukherjee',
  'Bose',
  'Das',
  'Roy',
  'Yadav',
];

const ROLES = ['Admin', 'Manager', 'Employee', 'Approver'];
const DEPARTMENTS = ['Finance', 'HR', 'IT', 'Operations', 'Procurement', 'Legal'];
const SAMPLE_USER_COUNT = 100;

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const toEmployeeId = (index) => `EMP${String(index + 1).padStart(3, '0')}`;

const toIndianPhone = (seed) => {
  // Generates +91 followed by a realistic 10-digit mobile number starting 6-9.
  const start = String(6 + (seed % 4));
  const remaining = String(100000000 + ((seed * 7919) % 900000000)).padStart(9, '0');
  return `+91${start}${remaining}`;
};

const buildUniqueUsers = async () => {
  const usedEmails = new Set();
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = [];
  let attempt = 0;

  while (users.length < SAMPLE_USER_COUNT) {
    attempt += 1;
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const sequence = users.length + 1;
    const baseEmail = `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '');
    const email = `${baseEmail}${sequence}@company.com`;

    if (usedEmails.has(email)) continue;
    usedEmails.add(email);

    users.push({
      name: `${firstName} ${lastName}`,
      email,
      employeeId: toEmployeeId(users.length),
      role: randomItem(ROLES),
      department: randomItem(DEPARTMENTS),
      phone: toIndianPhone(sequence + attempt),
      status: 'active',
      createdAt: new Date(),
      password: passwordHash,
    });
  }

  return users;
};

async function seedUsers() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || 'flowpilot',
    serverSelectionTimeoutMS: 10000,
  });

  try {
    // Clear prior seeded records to avoid duplicates and stale test data.
    await SeedUser.deleteMany({
      $or: [{ email: /@company\.com$/i }, { employeeId: /^EMP\d{3}$/ }],
    });

    const users = await buildUniqueUsers();
    await SeedUser.insertMany(users, { ordered: true });

    console.log('100 sample users inserted successfully');
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  seedUsers().catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  seedUsers,
};
