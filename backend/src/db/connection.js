const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

const connectToDatabase = async () => {
  if (!config.mongodbUri) {
    const error = new Error('MONGODB_URI is not configured');
    error.statusCode = 500;
    throw error;
  }

  await mongoose.connect(config.mongodbUri, {
    dbName: config.mongodbDbName,
    serverSelectionTimeoutMS: 10000,
  });

  logger.info('MongoDB connected', {
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
  });
};

const closeDatabaseConnection = async () => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};

const getDatabaseStatus = () => {
  const readyStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return readyStateMap[mongoose.connection.readyState] || 'unknown';
};

module.exports = {
  connectToDatabase,
  closeDatabaseConnection,
  getDatabaseStatus,
};
