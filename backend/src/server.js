const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const config = require('./config');
const { closeDatabaseConnection, connectToDatabase } = require('./db/connection');
const { bootstrapWorkflowData } = require('./services/bootstrap.service');
const { initializeSystemData } = require('./services/systemSetup.service');
const { seedAiWorkflowData } = require('./services/aiApprovalEngine.service');
const { ensureMongoIndexes } = require('./mongo/indexing');
const {
  startWorkflowMonitorScheduler,
  stopWorkflowMonitorScheduler,
} = require('./scheduler/workflowMonitor.scheduler');
const logger = require('./utils/logger');

let server;
let isDbConnectInProgress = false;

const connectDatabaseWithRetry = async () => {
  if (isDbConnectInProgress) return;
  isDbConnectInProgress = true;
  try {
    await connectToDatabase();
    await bootstrapWorkflowData({ dbConnected: true });
    await initializeSystemData();
    await ensureMongoIndexes();
    await seedAiWorkflowData();
  } catch (error) {
    logger.error('Database connection failed. Retrying in 10s...', {
      message: error.message,
    });
    await bootstrapWorkflowData({ dbConnected: false });
    setTimeout(connectDatabaseWithRetry, 10000);
  } finally {
    isDbConnectInProgress = false;
  }
};

const startServer = async () => {
  server = app.listen(config.port, () => {
    logger.info(
      `Infosys Approval System API started on http://localhost:${config.port}`,
    );
  });
  connectDatabaseWithRetry();
  startWorkflowMonitorScheduler();
};

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  if (!server) process.exit(1);
  stopWorkflowMonitorScheduler();
  server.close(async () => {
    await closeDatabaseConnection();
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });

  // In development we keep the API alive so transient async failures
  // (e.g. temporary network/database issues) do not break frontend fetch calls.
  if (config.nodeEnv !== 'production') return;

  if (!server) process.exit(1);
  stopWorkflowMonitorScheduler();
  server.close(async () => {
    await closeDatabaseConnection();
    process.exit(1);
  });
});

startServer().catch((error) => {
  logger.error('Failed to start server', { message: error.message, stack: error.stack });
  process.exit(1);
});
