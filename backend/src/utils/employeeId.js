const buildEmployeeId = () => `EMP${Math.floor(100000 + Math.random() * 900000)}`;

const generateUniqueEmployeeId = async (UserModel, maxAttempts = 20) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const employeeId = buildEmployeeId();
    // eslint-disable-next-line no-await-in-loop
    const exists = await UserModel.exists({ employeeId });
    if (!exists) return employeeId;
  }
  const error = new Error('Unable to generate unique employee ID');
  error.statusCode = 500;
  throw error;
};

module.exports = {
  generateUniqueEmployeeId,
};
