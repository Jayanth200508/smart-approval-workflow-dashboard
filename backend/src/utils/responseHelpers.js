const success = (res, data, status = 200) =>
  res.status(status).json({
    success: true,
    data,
  });

const error = (res, message, status = 400, details = null) =>
  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });

module.exports = {
  success,
  error,
};

