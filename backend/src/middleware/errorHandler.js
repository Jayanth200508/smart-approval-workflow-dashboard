const logger = require('../utils/logger');

const isDbConnectivityMessage = (message = '') => {
  const lower = String(message).toLowerCase();
  return (
    lower.includes('etimedout') ||
    lower.includes('server selection timed out') ||
    lower.includes('failed to connect') ||
    lower.includes('econnrefused') ||
    lower.includes('ehostunreach') ||
    lower.includes('mongoose') && lower.includes('timeout')
  );
};

const errorHandler = (err, req, res, _next) => {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  if (status >= 500 && isDbConnectivityMessage(message)) {
    status = 503;
    message = 'Service temporarily unavailable. Please try again shortly.';
  }

  logger.error('Request failed', {
    method: req.method,
    url: req.originalUrl,
    status,
    message,
  });

  return res.status(status).json({
    success: false,
    message,
    ...(err.details ? { details: err.details } : {}),
  });
};

const notFoundHandler = (req, res) =>
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });

module.exports = {
  errorHandler,
  notFoundHandler,
};
