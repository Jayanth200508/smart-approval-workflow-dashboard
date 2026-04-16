const path = require('path');

const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'flowpilot',
  allowedOrigins: envAllowedOrigins.length ? envAllowedOrigins : defaultAllowedOrigins,
  uploadsDir: path.join(process.cwd(), 'src', 'uploads'),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 200,
  workflowMonitorEnabled: String(process.env.WORKFLOW_MONITOR_ENABLED || 'true') !== 'false',
  workflowMonitorIntervalMs: Number(process.env.WORKFLOW_MONITOR_INTERVAL_MS) || 60 * 1000,
  workflowInactivityThresholdHours: Number(process.env.WORKFLOW_INACTIVITY_THRESHOLD_HOURS) || 24,
  workflowEscalationThresholdHours: Number(process.env.WORKFLOW_ESCALATION_THRESHOLD_HOURS) || 48,
  workflowOverloadThreshold: Number(process.env.WORKFLOW_OVERLOAD_THRESHOLD) || 6,
};

module.exports = config;
